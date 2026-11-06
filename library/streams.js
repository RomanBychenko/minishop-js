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

export { generateOrderFile };