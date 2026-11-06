import {
    createReadStream,
    createWriteStream
} from "node:fs";

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { orderGenerator } from "./generator.js";

// Створюємо записи для великого файлу
function* generateLines(count) {
    const orders = orderGenerator();

    for (let i = 0; i < count; i++) {
        const order = orders.next().value;

        yield JSON.stringify(order) + "\n";
    }
}

// Записуємо замовлення у файл поступово
async function generateOrderFile(path, count = 100000) {
    if (!Number.isInteger(count) || count < 0) {
        throw new Error("Invalid order count");
    }

    await pipeline(
        Readable.from(generateLines(count)),
        createWriteStream(path)
    );

    return count;
}
// Читаємо файл частинами та повертаємо окремі рядки
async function* readOrderLines(path) {
    const stream = createReadStream(path, {
        encoding: "utf8"
    });

    let buffer = "";

    for await (const chunk of stream) {
        buffer += chunk;

        const lines = buffer.split("\n");

        // Останній рядок може бути неповним
        buffer = lines.pop();

        for (const line of lines) {
            yield line;
        }
    }

    if (buffer.length > 0) {
        yield buffer;
    }
}

// Перевірка правильності запису
function isValidOrder(order) {
    return order !== null &&
        typeof order === "object" &&
        Number.isInteger(order.id) &&
        order.id > 0 &&
        Number.isInteger(order.productId) &&
        order.productId > 0 &&
        Number.isInteger(order.quantity) &&
        order.quantity > 0 &&
        [1, 2, 3].includes(order.priority);
}

// Читаємо, перевіряємо та записуємо замовлення
async function processOrderFile(inputPath, outputPath) {
    const stats = {
        read: 0,
        processed: 0,
        invalid: 0,
        totalQuantity: 0
    };

    async function* processLines() {
        for await (const line of readOrderLines(inputPath)) {
            if (!line.trim()) {
                continue;
            }

            stats.read++;

            let order;

            try {
                order = JSON.parse(line);
            } catch {
                stats.invalid++;
                continue;
            }

            if (!isValidOrder(order)) {
                stats.invalid++;
                continue;
            }

            order.status = "imported";

            stats.processed++;
            stats.totalQuantity += order.quantity;

            yield JSON.stringify(order) + "\n";
        }
    }

    await pipeline(
        Readable.from(processLines()),
        createWriteStream(outputPath)
    );

    return stats;
}

export {
    generateOrderFile,
    readOrderLines,
    processOrderFile
};