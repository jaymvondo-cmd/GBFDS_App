/*
 * Money flow map.
 *
 * Draws accounts as circles and transactions as arrows between them.
 * Accounts and arrows that take part in a circular ring (money that
 * leaves an account and comes back to it) are drawn in red, because
 * that is the pattern the analyst is hunting for.
 *
 * The layout is a small force simulation: every account pushes every
 * other account away, each transaction pulls its two accounts together,
 * and gravity keeps everything near the middle. Running that for a few
 * hundred steps naturally groups accounts that trade with each other.
 */
document.addEventListener("DOMContentLoaded", function () {
    var COLOR_NORMAL = "#2563eb";
    var COLOR_RING = "#dc2626";
    var COLOR_EDGE = "#cbd5e1";
    var COLOR_EDGE_RING = "#f87171";

    var svg = document.getElementById("graph-svg");
    var wrap = document.getElementById("graph-canvas-wrap");
    var emptyMessage = document.getElementById("graph-empty");
    var sideDefault = document.getElementById("graph-side-default");
    var sideDetail = document.getElementById("graph-side-detail");
    var ringList = document.getElementById("ring-list");

    var WIDTH = 900;
    var HEIGHT = 600;

    var state = { nodes: [], edges: [], cycles: [] };

    function money(value) {
        return Number(value).toLocaleString() + " FCFA";
    }

    function setStat(id, value) {
        var el = document.getElementById(id);
        el.textContent = value.toLocaleString();
        el.classList.remove("skeleton");
    }

    /* ---------------------------------------------------------------- */
    /* Layout                                                            */
    /* ---------------------------------------------------------------- */

    function layout(nodes, edges) {
        if (nodes.length === 0) return;

        // Start on a circle — a deterministic starting point means the
        // same data always produces the same picture.
        var radius = Math.min(WIDTH, HEIGHT) * 0.36;
        nodes.forEach(function (node, i) {
            var angle = (i / nodes.length) * Math.PI * 2;
            node.x = WIDTH / 2 + Math.cos(angle) * radius;
            node.y = HEIGHT / 2 + Math.sin(angle) * radius;
        });

        var byId = {};
        nodes.forEach(function (n) { byId[n.id] = n; });

        var ITERATIONS = 300;
        var REPULSION = 24000;
        var SPRING = 0.006;
        var IDEAL_EDGE_LENGTH = 110;
        var GRAVITY = 0.012;

        for (var step = 0; step < ITERATIONS; step++) {
            // Cooling: big moves early, small adjustments later.
            var damping = 1 - step / ITERATIONS;

            nodes.forEach(function (n) { n.dx = 0; n.dy = 0; });

            // Every account pushes every other one away.
            for (var i = 0; i < nodes.length; i++) {
                for (var j = i + 1; j < nodes.length; j++) {
                    var a = nodes[i];
                    var b = nodes[j];
                    var dx = a.x - b.x;
                    var dy = a.y - b.y;
                    var distSq = dx * dx + dy * dy || 0.01;
                    var dist = Math.sqrt(distSq);
                    var force = REPULSION / distSq;
                    var fx = (dx / dist) * force;
                    var fy = (dy / dist) * force;
                    a.dx += fx; a.dy += fy;
                    b.dx -= fx; b.dy -= fy;
                }
            }

            // Each transaction pulls its two accounts together.
            edges.forEach(function (edge) {
                var a = byId[edge.source];
                var b = byId[edge.target];
                if (!a || !b) return;
                var dx = b.x - a.x;
                var dy = b.y - a.y;
                var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
                var force = (dist - IDEAL_EDGE_LENGTH) * SPRING;
                var fx = (dx / dist) * force * dist;
                var fy = (dy / dist) * force * dist;
                a.dx += fx; a.dy += fy;
                b.dx -= fx; b.dy -= fy;
            });

            // Gentle pull to the centre so disconnected accounts don't
            // drift off the canvas.
            nodes.forEach(function (n) {
                n.dx += (WIDTH / 2 - n.x) * GRAVITY;
                n.dy += (HEIGHT / 2 - n.y) * GRAVITY;
            });

            nodes.forEach(function (n) {
                var maxMove = 30 * damping;
                var mx = Math.max(-maxMove, Math.min(maxMove, n.dx * damping));
                var my = Math.max(-maxMove, Math.min(maxMove, n.dy * damping));
                n.x += mx;
                n.y += my;
            });
        }
    }

    function nodeRadius(node) {
        var volume = node.sentCount + node.receivedCount;
        return Math.min(22, 9 + volume * 1.6);
    }

    /* ---------------------------------------------------------------- */
    /* Rendering                                                         */
    /* ---------------------------------------------------------------- */

    function el(tag, attrs) {
        var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.keys(attrs || {}).forEach(function (key) {
            node.setAttribute(key, attrs[key]);
        });
        return node;
    }

    function render() {
        svg.innerHTML = "";

        if (state.nodes.length === 0) {
            emptyMessage.hidden = false;
            svg.setAttribute("viewBox", "0 0 " + WIDTH + " " + HEIGHT);
            return;
        }
        emptyMessage.hidden = true;

        var defs = el("defs");
        [["arrow-normal", COLOR_EDGE], ["arrow-ring", COLOR_EDGE_RING]].forEach(function (pair) {
            var marker = el("marker", {
                id: pair[0],
                viewBox: "0 0 10 10",
                refX: "9", refY: "5",
                markerWidth: "6", markerHeight: "6",
                orient: "auto-start-reverse",
            });
            marker.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: pair[1] }));
            defs.appendChild(marker);
        });
        svg.appendChild(defs);

        var byId = {};
        state.nodes.forEach(function (n) { byId[n.id] = n; });

        // Fit the drawing to whatever area the layout ended up using.
        var xs = state.nodes.map(function (n) { return n.x; });
        var ys = state.nodes.map(function (n) { return n.y; });
        var pad = 50;
        var minX = Math.min.apply(null, xs) - pad;
        var maxX = Math.max.apply(null, xs) + pad;
        var minY = Math.min.apply(null, ys) - pad;
        var maxY = Math.max.apply(null, ys) + pad;
        svg.setAttribute("viewBox", minX + " " + minY + " " + (maxX - minX) + " " + (maxY - minY));

        var edgeLayer = el("g");
        var nodeLayer = el("g");
        svg.appendChild(edgeLayer);
        svg.appendChild(nodeLayer);

        state.edges.forEach(function (edge) {
            var a = byId[edge.source];
            var b = byId[edge.target];
            if (!a || !b) return;

            // Stop the line at the edge of the target circle so the
            // arrowhead is visible instead of hidden under the node.
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var ux = dx / dist;
            var uy = dy / dist;
            var startX = a.x + ux * nodeRadius(a);
            var startY = a.y + uy * nodeRadius(a);
            var endX = b.x - ux * (nodeRadius(b) + 7);
            var endY = b.y - uy * (nodeRadius(b) + 7);

            var line = el("line", {
                x1: startX, y1: startY, x2: endX, y2: endY,
                stroke: edge.inCycle ? COLOR_EDGE_RING : COLOR_EDGE,
                "stroke-width": edge.inCycle ? 2.4 : 1.4,
                "marker-end": "url(#" + (edge.inCycle ? "arrow-ring" : "arrow-normal") + ")",
                class: "graph-edge" + (edge.inCycle ? " graph-edge--ring" : ""),
            });
            line.style.cursor = "pointer";
            line.addEventListener("click", function () { showEdgeDetail(edge); });
            edgeLayer.appendChild(line);
        });

        state.nodes.forEach(function (node) {
            var group = el("g", { class: "graph-node" });
            group.style.cursor = "pointer";

            var circle = el("circle", {
                cx: node.x, cy: node.y, r: nodeRadius(node),
                fill: node.inCycle ? COLOR_RING : COLOR_NORMAL,
                stroke: "#ffffff",
                "stroke-width": 2,
            });

            var label = el("text", {
                x: node.x, y: node.y + nodeRadius(node) + 13,
                "text-anchor": "middle",
                "font-size": "11",
                fill: "#475569",
            });
            label.textContent = node.id;

            group.appendChild(circle);
            group.appendChild(label);
            group.addEventListener("click", function () { showNodeDetail(node); });
            nodeLayer.appendChild(group);
        });
    }

    /* ---------------------------------------------------------------- */
    /* Side panel                                                        */
    /* ---------------------------------------------------------------- */

    function backButton() {
        return '<button type="button" class="btn-secondary btn-secondary--sm" id="graph-side-back">Back to rings</button>';
    }

    function wireBack() {
        var btn = document.getElementById("graph-side-back");
        if (btn) {
            btn.addEventListener("click", function () {
                sideDetail.hidden = true;
                sideDefault.hidden = false;
            });
        }
    }

    function showEdgeDetail(edge) {
        sideDefault.hidden = true;
        sideDetail.hidden = false;
        sideDetail.innerHTML =
            backButton() +
            '<h2 class="chart-card__title chart-card__title--spaced">Transaction</h2>' +
            '<dl class="detail-list">' +
            "<div><dt>ID</dt><dd class='mono'>" + edge.transaction_id + "</dd></div>" +
            "<div><dt>Amount</dt><dd class='detail-amount'>" + money(edge.amount) + "</dd></div>" +
            "<div><dt>From</dt><dd class='mono'>" + edge.source + "</dd></div>" +
            "<div><dt>To</dt><dd class='mono'>" + edge.target + "</dd></div>" +
            "<div><dt>Type</dt><dd>" + edge.transaction_type + "</dd></div>" +
            "<div><dt>Location</dt><dd>" + (edge.location || "—") + "</dd></div>" +
            "<div><dt>Risk</dt><dd><span class='risk-badge risk-badge--" + edge.classification + "'>" + edge.classification + "</span></dd></div>" +
            "<div><dt>Date</dt><dd>" + new Date(edge.date_time).toLocaleString() + "</dd></div>" +
            "<div><dt>In a ring</dt><dd>" + (edge.inCycle ? "Yes" : "No") + "</dd></div>" +
            "</dl>" +
            '<a class="btn-secondary btn-secondary--sm" href="/transactions/' + edge.transaction_id + '">Open full details</a>';
        wireBack();
    }

    function showNodeDetail(node) {
        sideDefault.hidden = true;
        sideDetail.hidden = false;
        sideDetail.innerHTML = backButton() + '<p class="chart-card__subtitle">Loading account…</p>';
        wireBack();

        fetch("/api/accounts/" + node.id)
            .then(function (res) { return res.json(); })
            .then(function (account) {
                var rows = account.recentTransactions
                    .map(function (t) {
                        var direction = t.sender_id === account.accountId ? "out" : "in";
                        var other = direction === "out" ? t.receiver_id : t.sender_id;
                        return (
                            "<li><span class='flow-" + direction + "'>" +
                            (direction === "out" ? "→ to " : "← from ") + other +
                            "</span><span>" + money(t.amount) + "</span></li>"
                        );
                    })
                    .join("");

                sideDetail.innerHTML =
                    backButton() +
                    '<h2 class="chart-card__title chart-card__title--spaced">Account ' + account.accountId + "</h2>" +
                    (node.inCycle ? '<p class="ring-warning">This account is part of a circular ring.</p>' : "") +
                    '<dl class="detail-list">' +
                    "<div><dt>Sent</dt><dd>" + money(account.totalSent) + " (" + account.sentCount + ")</dd></div>" +
                    "<div><dt>Received</dt><dd>" + money(account.totalReceived) + " (" + account.receivedCount + ")</dd></div>" +
                    "<div><dt>Flagged transactions</dt><dd>" + account.flaggedCount + "</dd></div>" +
                    "</dl>" +
                    '<h3 class="chart-card__subtitle chart-card__title--spaced">Recent activity</h3>' +
                    '<ul class="flow-list">' + (rows || "<li>No activity</li>") + "</ul>" +
                    '<a class="btn-secondary btn-secondary--sm" href="/transactions?accountId=' + account.accountId + '">See all transactions</a>';
                wireBack();
            })
            .catch(function () {
                sideDetail.innerHTML = backButton() + '<p class="chart-card__subtitle">Could not load this account.</p>';
                wireBack();
            });
    }

    function renderRingList() {
        if (state.cycles.length === 0) {
            ringList.innerHTML = '<li class="ring-list__empty">No circular rings in this view. That is a good sign.</li>';
            return;
        }

        ringList.innerHTML = state.cycles
            .map(function (cycle, index) {
                var path = cycle.concat([cycle[0]]).join(" → ");
                return (
                    '<li class="ring-list__item" data-ring="' + index + '">' +
                    '<span class="ring-list__badge">Ring ' + (index + 1) + "</span>" +
                    '<span class="ring-list__path mono">' + path + "</span>" +
                    '<span class="ring-list__meta">' + cycle.length + " accounts</span>" +
                    "</li>"
                );
            })
            .join("");
    }

    /* ---------------------------------------------------------------- */
    /* Load                                                              */
    /* ---------------------------------------------------------------- */

    var query = window.location.search || "";

    fetch("/api/graph" + query)
        .then(function (res) {
            if (!res.ok) throw new Error("Failed to load graph (" + res.status + ")");
            return res.json();
        })
        .then(function (data) {
            state = data;

            setStat("stat-node-count", data.nodes.length);
            setStat("stat-edge-count", data.transactionCount);
            setStat("stat-cycle-count", data.cycles.length);

            layout(state.nodes, state.edges);
            render();
            renderRingList();
        })
        .catch(function (err) {
            console.error(err);
            emptyMessage.hidden = false;
            emptyMessage.textContent = "Could not load the money flow map.";
        });
});
