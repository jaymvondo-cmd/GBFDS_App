const { Op } = require("sequelize");
const { Transaction } = require("../models");

/**
 * findCycles — finds every circular money path in the transaction graph.
 *
 * A "circular ring" is money that leaves an account and eventually comes
 * back to it: A -> B -> C -> A. This is a classic laundering pattern,
 * because the money looks like normal business activity at each hop but
 * ends up back where it started.
 *
 * How it works: we walk the graph depth-first from every account. We keep
 * the accounts we are currently standing on in `path`. If we ever reach an
 * account that is already in `path`, we just closed a loop — everything
 * from that account onwards in `path` is the cycle.
 *
 * The same loop can be discovered from several starting points
 * (A->B->C->A is the same ring as B->C->A->B), so each cycle is rotated
 * to start at its smallest account number and de-duplicated by that key.
 *
 * @param {Map<number, number[]>} adjacency - account -> accounts it pays
 * @returns {number[][]} list of cycles, each an array of account ids
 */
function findCycles(adjacency) {
    const cycles = [];
    const seenCycleKeys = new Set();

    function normalizeAndStore(cycleNodes) {
        // Rotate so the smallest id is first, so the same ring found from
        // a different starting point produces the same key.
        const smallest = Math.min(...cycleNodes);
        const startIndex = cycleNodes.indexOf(smallest);
        const rotated = cycleNodes.slice(startIndex).concat(cycleNodes.slice(0, startIndex));
        const key = rotated.join(">");

        if (!seenCycleKeys.has(key)) {
            seenCycleKeys.add(key);
            cycles.push(rotated);
        }
    }

    function walk(node, path, onPath) {
        const neighbours = adjacency.get(node) || [];

        for (const next of neighbours) {
            if (onPath.has(next)) {
                // Found a loop: take the slice of the path from `next` onwards.
                const loopStart = path.indexOf(next);
                normalizeAndStore(path.slice(loopStart));
                continue;
            }
            // Depth cap: rings longer than 8 accounts are almost never a
            // useful signal for an analyst, and exploring them makes this
            // very slow on a dense graph.
            if (path.length >= 8) continue;

            path.push(next);
            onPath.add(next);
            walk(next, path, onPath);
            path.pop();
            onPath.delete(next);
        }
    }

    for (const startNode of adjacency.keys()) {
        walk(startNode, [startNode], new Set([startNode]));
    }

    return cycles;
}

/**
 * getGraphData — builds everything the money-flow graph screen needs.
 *
 * Optional filters narrow which transactions are included, so an analyst
 * can focus the picture (e.g. only large amounts, or a single account).
 *
 * Returns:
 *   nodes  - one per account, with how much it sent/received
 *   edges  - one per transaction, flagged if it is part of a ring
 *   cycles - the rings themselves, so they can be listed and highlighted
 */
async function getGraphData(filters = {}) {
    const where = {};

    if (filters.dateFrom || filters.dateTo) {
        where.date_time = {};
        if (filters.dateFrom) where.date_time[Op.gte] = new Date(filters.dateFrom);
        if (filters.dateTo) where.date_time[Op.lte] = new Date(filters.dateTo + "T23:59:59");
    }
    if (filters.minAmount) {
        where.amount = { ...(where.amount || {}), [Op.gte]: Number(filters.minAmount) };
    }
    if (filters.maxAmount) {
        where.amount = { ...(where.amount || {}), [Op.lte]: Number(filters.maxAmount) };
    }
    if (filters.classification) {
        where.classification = filters.classification;
    }
    if (filters.accountId) {
        const id = Number(filters.accountId);
        where[Op.or] = [{ sender_id: id }, { receiver_id: id }];
    }

    const transactions = await Transaction.findAll({ where, order: [["date_time", "ASC"]], raw: true });

    const nodeMap = new Map();
    const adjacency = new Map();

    function touchNode(id) {
        if (!nodeMap.has(id)) {
            nodeMap.set(id, { id, sent: 0, received: 0, sentCount: 0, receivedCount: 0 });
        }
        if (!adjacency.has(id)) adjacency.set(id, []);
        return nodeMap.get(id);
    }

    const edges = transactions.map((tx) => {
        const sender = touchNode(tx.sender_id);
        const receiver = touchNode(tx.receiver_id);

        const amount = Number(tx.amount);
        sender.sent += amount;
        sender.sentCount += 1;
        receiver.received += amount;
        receiver.receivedCount += 1;

        const neighbours = adjacency.get(tx.sender_id);
        if (!neighbours.includes(tx.receiver_id)) neighbours.push(tx.receiver_id);

        return {
            transaction_id: tx.transaction_id,
            source: tx.sender_id,
            target: tx.receiver_id,
            amount,
            date_time: tx.date_time,
            transaction_type: tx.transaction_type,
            location: tx.location,
            classification: tx.classification,
            risk_score: tx.risk_score,
            inCycle: false,
        };
    });

    const cycles = findCycles(adjacency);

    // Flag every edge that takes part in a ring, so the screen can draw
    // those connections in red.
    const cycleEdgeKeys = new Set();
    cycles.forEach((cycle) => {
        for (let i = 0; i < cycle.length; i++) {
            const from = cycle[i];
            const to = cycle[(i + 1) % cycle.length];
            cycleEdgeKeys.add(`${from}->${to}`);
        }
    });

    const cycleNodeIds = new Set();
    cycles.forEach((cycle) => cycle.forEach((id) => cycleNodeIds.add(id)));

    edges.forEach((edge) => {
        if (cycleEdgeKeys.has(`${edge.source}->${edge.target}`)) edge.inCycle = true;
    });

    const nodes = [...nodeMap.values()].map((node) => ({
        ...node,
        inCycle: cycleNodeIds.has(node.id),
    }));

    // Turn each bare ring (a list of account ids) into something a person
    // can read: the actual hops, with the amount moved at each one, plus
    // the total that went round the loop. Without this the analyst just
    // sees "1002 > 1003 > 1004" and has to go dig for the numbers.
    const edgeLookup = new Map();
    edges.forEach((edge) => {
        const key = `${edge.source}->${edge.target}`;
        // Several transactions can run between the same pair; keep the
        // largest, since that is the one worth showing on the ring.
        const existing = edgeLookup.get(key);
        if (!existing || edge.amount > existing.amount) edgeLookup.set(key, edge);
    });

    const detailedCycles = cycles.map((cycle) => {
        const hops = [];
        for (let i = 0; i < cycle.length; i++) {
            const from = cycle[i];
            const to = cycle[(i + 1) % cycle.length];
            const edge = edgeLookup.get(`${from}->${to}`);
            hops.push({
                from,
                to,
                amount: edge ? edge.amount : 0,
                transaction_id: edge ? edge.transaction_id : null,
                date_time: edge ? edge.date_time : null,
            });
        }
        return {
            accounts: cycle,
            hops,
            totalAmount: hops.reduce((sum, h) => sum + h.amount, 0),
        };
    });

    return {
        nodes,
        edges,
        cycles,
        detailedCycles,
        transactionCount: transactions.length,
    };
}

module.exports = { getGraphData, findCycles };
