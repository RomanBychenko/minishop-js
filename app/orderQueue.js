import { PriorityQueue } from "minishop-utils";
import { shopEvents } from "./shopEvents.js";

const orderQueue = new PriorityQueue();

// Додаємо замовлення з його пріоритетом
function addOrder(order) {
    orderQueue.enqueue(order, order.priority ?? 2);

    shopEvents.publish("order:created", order);
}

// Переглядаємо наступне замовлення
function peekOrder(mode = "highest") {
    return orderQueue.peek(mode);
}

// Забираємо замовлення для подальшої обробки
function takeOrder(mode = "highest") {
    return orderQueue.dequeue(mode);
}

function getOrders() {
    return orderQueue.toArray();
}

export {
    addOrder,
    peekOrder,
    takeOrder,
    getOrders
};