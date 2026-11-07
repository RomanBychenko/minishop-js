import { asyncMapPromise } from "minishop-utils";
import { setTimeout as delay } from "node:timers/promises";
import { logFunction } from "./shopLogger.js";

// Обробка окремого замовлення
async function processSingleOrder(order, signal) {
    if (!Number.isInteger(order.quantity) || order.quantity <= 0) {
        throw new Error("Invalid order quantity");
    }

    // Імітуємо час, необхідний для обробки
    await delay(300, undefined, { signal });

    return {
        ...order,
        status: "processed"
    };
}

const processOrder = logFunction(processSingleOrder);

// Асинхронна обробка масиву замовлень
async function processOrders(orders, options = {}) {
    const { signal, onProcessed = () => {} } = options;

    return asyncMapPromise(
        orders,
        async (order, index, signal) => {
            const result = await processOrder(order, signal);

            onProcessed(result);

            return result;
        },
        { signal }
    );
}

export { processOrder, processOrders };