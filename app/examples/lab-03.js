import assert from "node:assert/strict";
import { memoize } from "minishop-utils";
import {
    calculateTotal,
    calculateDelivery
} from "../pricing.js";

console.log("Lab 3 - Memoization\n");

const square = (number) => number * number;

// Кеш без обмеження розміру
const basic = memoize(square);

assert.equal(basic(5), 25);
assert.equal(basic(5), 25);
assert.equal(basic.getStats().hits, 1);

console.log("Basic:", basic.getStats());

// Least Recently Used
const lru = memoize(square, {
    maxSize: 2,
    policy: "LRU"
});

lru(1);
lru(2);
lru(1);
lru(3);
lru(1);

assert.equal(lru.getStats().hits, 2);

lru(2);

assert.equal(lru.getStats().misses, 4);
assert.equal(lru.getStats().size, 2);

console.log("LRU:", lru.getStats());

// Least Frequently Used
const lfu = memoize(square, {
    maxSize: 2,
    policy: "LFU"
});

lfu(1);
lfu(1);
lfu(1);
lfu(2);
lfu(3);
lfu(1);
lfu(2);

assert.equal(lfu.getStats().hits, 3);
assert.equal(lfu.getStats().misses, 4);

console.log("LFU:", lfu.getStats());

// Видалення за часом
const ttl = memoize(square, {
    policy: "TTL",
    ttlMs: 100
});

ttl(5);
ttl(5);

await new Promise((resolve) => {
    setTimeout(resolve, 200);
});

assert.equal(ttl.getStats().size, 0);

ttl(5);

assert.equal(ttl.getStats().misses, 2);

console.log("TTL:", ttl.getStats());

// Власна стратегія: видаляємо останній запис
const custom = memoize(square, {
    maxSize: 2,
    policy: "CUSTOM",
    customEvict: (cache) => cache.length - 1
});

custom(1);
custom(2);
custom(3);
custom(1);
custom(2);

assert.equal(custom.getStats().hits, 1);
assert.equal(custom.getStats().misses, 4);

console.log("Custom:", custom.getStats());

// Перевірка кешування undefined
const emptyResult = memoize(() => undefined);

emptyResult();
emptyResult();

assert.equal(emptyResult.getStats().hits, 1);

// Використання у магазині
console.log("\nShop example:");

console.log("Order total:", calculateTotal(500, 3, 10));
console.log("Order total:", calculateTotal(500, 3, 10));
console.log("Delivery:", calculateDelivery(1350));
console.log("Price cache:", calculateTotal.getStats());

assert.equal(calculateTotal(500, 3, 10), 1350);
assert.equal(calculateDelivery(6000), 0);

console.log("\nAll memoization checks passed.");