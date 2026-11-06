import { mkdir } from "node:fs/promises";

import {
    generateOrderFile,
    processOrderFile
} from "minishop-utils";

const dataDir = new URL("./data/generated/", import.meta.url);

// Генеруємо тестовий файл із замовленнями
async function createTestOrders(count = 100000) {
    await mkdir(dataDir, { recursive: true });

    const path = new URL("sample-orders.jsonl", dataDir);

    await generateOrderFile(path, count);

    return path;
}

// Імпортуємо замовлення та повертаємо статистику
async function importOrders(inputPath) {
    await mkdir(dataDir, { recursive: true });

    const outputPath = new URL(
        "imported-orders.jsonl",
        dataDir
    );

    return processOrderFile(inputPath, outputPath);
}

export {
    createTestOrders,
    importOrders
};