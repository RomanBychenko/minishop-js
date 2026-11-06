import assert from "node:assert/strict";
import { EventBus } from "minishop-utils";

import { addOrder } from "../orderQueue.js";

import {
    shopEvents,
    getNotifications,
    getStats,
    stopNotifications
} from "../shopEvents.js";

console.log("Lab 7 - Reactive Communication\n");

const bus = new EventBus();

let firstCount = 0;
let secondCount = 0;

// Два незалежні підписники
const unsubscribe = bus.subscribe("message", (data) => {
    firstCount++;
    console.log("Listener 1:", data);
});

bus.subscribe("message", (data) => {
    secondCount++;
    console.log("Listener 2:", data);
});

bus.publish("message", "Hello MiniShop");

assert.equal(firstCount, 1);
assert.equal(secondCount, 1);
assert.equal(bus.listenerCount("message"), 2);

// Видаляємо першого підписника
unsubscribe();

console.log("\nAfter unsubscribe:");

bus.publish("message", "New message");

assert.equal(firstCount, 1);
assert.equal(secondCount, 2);
assert.equal(bus.listenerCount("message"), 1);

// Перевірка подій магазину
addOrder({ id: 1001, priority: 2 });

shopEvents.publish("order:completed", {
    id: 1001
});

console.log("\nNotifications:", getNotifications());
console.log("Statistics:", getStats());

assert.equal(getStats().created, 1);
assert.equal(getStats().completed, 1);
assert.equal(getNotifications().length, 2);

// Вимикаємо повідомлення про нові замовлення
stopNotifications();

addOrder({ id: 1002, priority: 1 });

assert.equal(getStats().created, 2);
assert.equal(getNotifications().length, 2);

console.log("\nAll event checks passed.");