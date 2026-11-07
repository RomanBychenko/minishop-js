import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import {
    orderGenerator, consumeFor, PriorityQueue, readOrderLines
} from "minishop-utils";
import { calculateTotal, calculateDelivery } from "./pricing.js";
import { addOrder, getOrders, peekOrder, takeOrder } from "./orderQueue.js";
import { processOrder, processOrders } from "./orderProcessing.js";
import { createTestOrders, importOrders } from "./orderImport.js";
import { shopEvents, getNotifications, getStats } from "./shopEvents.js";
import { createDeliveryClient, sendOrder } from "./deliveryClient.js";

const products = JSON.parse(readFileSync(
    new URL("./data/products.json", import.meta.url), "utf8"
));

const modes = ["highest", "lowest", "oldest", "newest"];
const authMethods = ["API_KEY", "JWT", "OAUTH"];
const dataDir = new URL("./data/generated/", import.meta.url);

function checkMode(mode) {
    if (!modes.includes(mode)) {
        throw new Error("Невідомий режим черги");
    }
}

function createShop(deliveryUrl) {
    let nextId = 1001;
    let busy = null;
    let controller = null;
    let importStats = null;
    const history = [];
    const requests = [];

    const client = createDeliveryClient(deliveryUrl, {
        logger(entry) {
            requests.push(entry);
            if (requests.length > 50) requests.shift();
        }
    });

    function checkBusy() {
        if (busy) throw new Error("Дочекайся завершення поточної операції");
    }

    // Рахуємо суму через функції з третьої лабораторної
    function makeOrder(items, priority = 2) {
        if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            throw new Error("Кошик порожній або некоректний");
        }
        if (![1, 2, 3].includes(priority)) {
            throw new Error("Некоректний пріоритет");
        }
        const lines = [];
        let subtotal = 0;
        let quantity = 0;

        for (const item of items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product || !Number.isInteger(item.quantity) ||
                item.quantity < 1 || item.quantity > 99) {
                throw new Error("Некоректний товар або кількість");
            }
            const discount = item.quantity >= 3 ? 10 : 0;
            const total = calculateTotal(product.price, item.quantity, discount);
            lines.push({
                productId: product.id, name: product.name,
                price: product.price, quantity: item.quantity, discount, total
            });
            subtotal += total;
            quantity += item.quantity;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        const delivery = calculateDelivery(subtotal);
        const order = {
            id: nextId++, items: lines, quantity, priority,
            subtotal, delivery, total: subtotal + delivery, status: "pending"
        };
        addOrder(order);
        return order;
    }

    function checkout(items, priority) {
        checkBusy();
        return makeOrder(items, priority);
    }

    // Генератор працює протягом заданого часу
    async function generate(seconds) {
        checkBusy();
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 10) {
            throw new Error("Вкажи від 1 до 10 секунд");
        }
        busy = "generation";
        try {
            const iterator = orderGenerator(nextId);
            return await consumeFor(iterator, seconds, (order) => {
                makeOrder([order], order.priority);
            });
        } finally {
            busy = null;
        }
    }

    function remember(order) {
        history.push(order);
        if (history.length > 100) history.shift();
    }

    // Обираємо порядок, але видаляємо запис лише після обробки
    async function process(mode, method, count) {
        checkBusy();
        checkMode(mode);
        if (!authMethods.includes(method)) throw new Error("Невідома авторизація");
        if (!Number.isInteger(count) || count < 1 || count > 100) {
            throw new Error("Некоректна кількість замовлень");
        }
        const selection = new PriorityQueue();
        for (const order of getOrders()) selection.enqueue(order, order.priority);
        const batch = [];
        while (!selection.isEmpty() && batch.length < count) {
            batch.push(selection.dequeue(mode));
        }
        if (!batch.length) return { completed: 0, status: "empty" };

        busy = "processing";
        controller = new AbortController();
        const signal = controller.signal;
        let active = null;
        let completed = 0;
        client.setStrategy(method);

        try {
            await processOrders(batch, {
                signal,
                async handler(order, signal) {
                    signal.throwIfAborted();
                    active = order;
                    const processed = await processOrder(order, signal);
                    signal.throwIfAborted();
                    const response = await sendOrder(client, processed, signal);
                    signal.throwIfAborted();
                    return { ...processed, status: "completed", authMethod: response.authMethod };
                },
                onProcessed(order) {
                    takeOrder(mode);
                    remember(order);
                    completed++;
                    active = null;
                    shopEvents.publish("order:completed", order);
                }
            });
            return { completed, status: "completed" };
        } catch (error) {
            if (signal.aborted) {
                // Незавершене замовлення залишається у черзі
                if (active) shopEvents.publish("order:cancelled", active);
                return { completed, status: "cancelled" };
            }
            if (active) {
                takeOrder(mode);
                const failed = { ...active, status: "failed" };
                remember(failed);
                shopEvents.publish("order:failed", failed);
            }
            throw error;
        } finally {
            controller = null;
            busy = null;
        }
    }

    function cancel() {
        if (!controller) return false;
        controller.abort();
        return true;
    }

    // Імпорт не накопичує замовлення в оперативній пам'яті
    async function importDemo(count) {
        checkBusy();
        if (!Number.isInteger(count) || count < 1 || count > 1000000) {
            throw new Error("Вкажи від 1 до 1000000 записів");
        }
        busy = "import";
        try {
            importStats = await importOrders(await createTestOrders(count));
            return importStats;
        } finally {
            busy = null;
        }
    }

    async function importUpload(stream) {
        checkBusy();
        busy = "import";
        try {
            await mkdir(dataDir, { recursive: true });
            const path = new URL("uploaded-orders.jsonl", dataDir);
            let bytes = 0;
            const limit = new Transform({
                transform(chunk, encoding, callback) {
                    bytes += chunk.length;
                    if (bytes > 100 * 1024 * 1024) {
                        callback(new Error("Файл більший за 100 МБ"));
                    } else {
                        callback(null, chunk);
                    }
                }
            });
            await pipeline(stream, limit, createWriteStream(path));
            importStats = await importOrders(path);
            return importStats;
        } finally {
            busy = null;
        }
    }

    async function getLogs() {
        const logs = [];
        try {
            for await (const line of readOrderLines(new URL("./logs/shop.log", import.meta.url))) {
                if (!line.trim()) continue;
                try { logs.push(JSON.parse(line)); } catch { continue; }
                if (logs.length > 50) logs.shift();
            }
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
        return logs.reverse();
    }

    function getState(mode = "highest") {
        checkMode(mode);
        return {
            products, queue: getOrders(), next: peekOrder(mode) ?? null,
            history: [...history].reverse(), stats: getStats(),
            notifications: getNotifications().reverse(),
            cache: { pricing: calculateTotal.getStats(), delivery: calculateDelivery.getStats() },
            requests: [...requests].reverse(), importStats, busy
        };
    }

    return { checkout, generate, process, cancel, importDemo, importUpload, getLogs, getState };
}

export { createShop };
