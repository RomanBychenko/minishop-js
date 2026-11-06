import assert from "node:assert/strict";
import {
    asyncMapCallback,
    asyncMapPromise
} from "minishop-utils";

import { processOrders } from "../orderProcessing.js";

console.log("Lab 5 - Async Map\n");

const numbers = [1, 2, 3, 4];

// Callback
await new Promise((resolve, reject) => {
    asyncMapCallback(
        numbers,
        (number, index, done) => {
            setTimeout(() => {
                done(null, number * 2);
            }, 50);
        },
        (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            console.log("Callback:", result);
            resolve(result);
        }
    );
}).then((result) => {
    assert.deepEqual(result, [2, 4, 6, 8]);
});

// Promise
await asyncMapPromise(
    numbers,
    async (number) => number * 3
).then((result) => {
    console.log("Promise:", result);

    assert.deepEqual(result, [3, 6, 9, 12]);
});

// Async/await
const result = await asyncMapPromise(
    numbers,
    async (number) => number * number
);

console.log("Async/await:", result);

assert.deepEqual(result, [1, 4, 9, 16]);

// Перевірка обробки замовлень
const orders = [
    { id: 1001, quantity: 2 },
    { id: 1002, quantity: 1 },
    { id: 1003, quantity: 3 }
];

const processed = await processOrders(orders);

assert.equal(processed.length, 3);
assert.equal(processed[0].status, "processed");

console.log("\nProcessed orders:", processed);

// Скасування операції
const controller = new AbortController();

let completed = 0;

const operation = processOrders(orders, {
    signal: controller.signal,
    onProcessed: () => {
        completed++;
    }
});

setTimeout(() => {
    controller.abort();
}, 450);

await assert.rejects(operation, /aborted/);

console.log("\nOperation aborted.");
console.log("Completed before abort:", completed);

assert.ok(completed < orders.length);

// Додаткові перевірки
assert.deepEqual(
    await asyncMapPromise([], async (value) => value),
    []
);

await assert.rejects(
    asyncMapPromise([1], async () => {
        throw new Error("Test error");
    }),
    /Test error/
);

const stopped = new AbortController();
stopped.abort();

await assert.rejects(
    asyncMapPromise(numbers, async (value) => value, {
        signal: stopped.signal
    }),
    /aborted/
);

console.log("\nAll async map checks passed.");