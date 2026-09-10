/*
 * Circular-ring detection.
 *
 * This is the heart of the fraud engine, and it is pure logic — it takes a
 * plain map of "who pays whom" and returns the loops it finds — so it can
 * be tested on its own without any database.
 */
const { findCycles } = require("../services/graph.service");

// Helper: build the adjacency map findCycles expects.
function graph(pairs) {
    const map = new Map();
    for (const [from, to] of pairs) {
        if (!map.has(from)) map.set(from, []);
        if (!map.has(to)) map.set(to, []);
        map.get(from).push(to);
    }
    return map;
}

describe("findCycles", () => {
    test("finds a simple three-account ring", () => {
        // A pays B, B pays C, C pays back to A.
        const cycles = findCycles(graph([[1, 2], [2, 3], [3, 1]]));
        expect(cycles).toHaveLength(1);
        expect(cycles[0].sort()).toEqual([1, 2, 3]);
    });

    test("finds nothing when money only flows one way", () => {
        expect(findCycles(graph([[1, 2], [2, 3], [3, 4]]))).toEqual([]);
    });

    test("finds two separate rings", () => {
        const cycles = findCycles(graph([[1, 2], [2, 3], [3, 1], [10, 11], [11, 12], [12, 10]]));
        expect(cycles).toHaveLength(2);
    });

    test("finds two accounts paying each other back and forth", () => {
        const cycles = findCycles(graph([[1, 2], [2, 1]]));
        expect(cycles).toHaveLength(1);
        expect(cycles[0].sort()).toEqual([1, 2]);
    });

    test("reports the same ring once, not once per starting account", () => {
        // A->B->C->A can be discovered starting from A, from B or from C.
        // It is still one ring and must only be reported once.
        const cycles = findCycles(graph([[1, 2], [2, 3], [3, 1]]));
        expect(cycles).toHaveLength(1);
    });

    test("a ring is still found when unrelated payments are mixed in", () => {
        const cycles = findCycles(
            graph([[1, 2], [2, 3], [3, 1], [5, 6], [7, 8], [2, 9]])
        );
        expect(cycles).toHaveLength(1);
        expect(cycles[0].sort()).toEqual([1, 2, 3]);
    });

    test("handles an empty graph", () => {
        expect(findCycles(new Map())).toEqual([]);
    });
});
