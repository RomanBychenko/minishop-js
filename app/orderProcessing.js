import { asyncMapPromise } from "minishop-utils";
import { setTimeout as delay } from "node:timers/promises";
import { logFunction } from "./shopLogger.js";

// Обробка окремого замовлення
async function processSingleOrder(order, signal) {
    if (!Number.isInteger(order.quantity) || order.quantity <= 0) {
        throw new Error("Invalid order quantity");
    }

    await delay(300, undefined, { signal });

    return {
        ...order,
        status: "processed"
    };
}

const processOrder = logFunction(processSingleOrder);

async function processOrders(orders, options = {}) {
    const {
        signal,
        onProcessed = () => {},
        handler = processOrder
    } = options;

    return asyncMapPromise(
        orders,
        async (order, index, signal) => {
            const result = await handler(order, signal);

            // Не змінюємо стан після скасування операції
            signal?.throwIfAborted();
            await onProcessed(result);

            return result;
        },
        { signal }
    );
}

export { processOrder, processOrders };
