import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

import {
    processOrderFile,
    readOrderLines
} from "minishop-utils";

import {
    createTestOrders,
    importOrders
} from "../orderImport.js";

console.log("Lab 6 - Large Data Processing\n");

const count = 100000;

console.time("Generation");

const inputPath = await createTestOrders(count);

console.timeEnd("Generation");

console.log("Generated orders:", count);

// Обробляємо великий файл
console.time("Processing");

const stats = await importOrders(inputPath);

console.timeEnd("Processing");

console.log("\nImport statistics:", stats);

assert.equal(stats.read, count);
assert.equal(stats.processed, count);
assert.equal(stats.invalid, 0);

assert.ok(stats.totalQuantity >= count);

// Перевіряємо кількість записів у вихідному файлі
const importedPath = new URL(
    "imported-orders.jsonl",
    inputPath
);

let importedCount = 0;

for await (const line of readOrderLines(importedPath)) {
    const order = JSON.parse(line);

    assert.equal(order.status, "imported");

    importedCount++;
}

assert.equal(importedCount, count);

// Перевірка неправильних записів
const invalidPath = new URL("invalid-orders.jsonl", inputPath);
const outputPath = new URL("checked-orders.jsonl", inputPath);

const testData = [
    '{"id":1,"productId":2,"quantity":3,"priority":1}',
    'Invalid JSON',
    '{"id":2,"productId":1,"quantity":-5,"priority":2}',
    '{"id":3,"productId":3,"quantity":2,"priority":3}'
].join("\n");

await writeFile(invalidPath, testData);

const checked = await processOrderFile(
    invalidPath,
    outputPath
);

console.log("\nValidation test:", checked);

assert.equal(checked.read, 4);
assert.equal(checked.processed, 2);
assert.equal(checked.invalid, 2);
assert.equal(checked.totalQuantity, 5);

console.log("\nAll stream checks passed.");