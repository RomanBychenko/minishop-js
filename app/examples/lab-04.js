import assert from "node:assert/strict";
import { PriorityQueue } from "minishop-utils";

import {
    addOrder,
    peekOrder,
    takeOrder,
    getOrders
} from "../orderQueue.js";

console.log("Lab 4 - Priority Queue\n");

const queue = new PriorityQueue();

queue.enqueue("A", 2);
queue.enqueue("B", 3);
queue.enqueue("C", 1);
queue.enqueue("D", 2);

console.log("Queue:", queue.toArray());

// Перевіряємо всі режими peek
console.log("Highest:", queue.peek("highest"));
console.log("Lowest:", queue.peek("lowest"));
console.log("Oldest:", queue.peek("oldest"));
console.log("Newest:", queue.peek("newest"));

assert.equal(queue.peek("highest"), "B");
assert.equal(queue.peek("lowest"), "C");
assert.equal(queue.peek("oldest"), "A");
assert.equal(queue.peek("newest"), "D");
assert.equal(queue.size, 4);

// Перевіряємо видалення
assert.equal(queue.dequeue("highest"), "B");
assert.equal(queue.dequeue("lowest"), "C");
assert.equal(queue.dequeue("newest"), "D");
assert.equal(queue.dequeue("oldest"), "A");

// Перевіряємо порожню чергу
assert.equal(queue.isEmpty(), true);
assert.equal(queue.peek(), undefined);
assert.equal(queue.dequeue(), undefined);

// Однакові пріоритети
queue.enqueue("First", 2);
queue.enqueue("Second", 2);

assert.equal(queue.peek("highest"), "First");
assert.equal(queue.peek("lowest"), "First");
assert.equal(queue.dequeue("highest"), "First");
assert.equal(queue.dequeue("lowest"), "Second");

assert.throws(() => queue.peek("wrong"));
assert.throws(() => queue.enqueue("Invalid", NaN));

console.log("\nAll queue checks passed.");

// Приклад роботи магазину
console.log("\nShop orders:");

addOrder({
    id: 1001,
    priority: 1
});

addOrder({
    id: 1002,
    priority: 3
});

addOrder({
    id: 1003,
    priority: 2
});

console.log("Orders:", getOrders());
console.log("Next order:", peekOrder());
console.log("Processing:", takeOrder());
console.log("Remaining:", getOrders());

assert.equal(getOrders().length, 2);
assert.equal(peekOrder().id, 1003);