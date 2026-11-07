import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";

import { withLogging } from "minishop-utils";

import {
    createFileSink,
    createHttpLogSink
} from "../shopLogger.js";

import {
    credentials,
    startDeliveryApi
} from "../deliveryApi.js";

console.log("Lab 9 - Logging Decorator\n");

const logs = [];

function add(a, b) {
    return a + b;
}

// Логування синхронної функції
const loggedAdd = withLogging(add, {
    level: "INFO",
    sink: (message) => logs.push(JSON.parse(message))
});

assert.equal(loggedAdd(5, 10), 15);
assert.equal(logs[0].result, 15);
assert.deepEqual(logs[0].args, [5, 10]);
assert.equal(logs[0].level, "INFO");

console.log("Sync function:", logs[0]);

// Логування асинхронної функції
const asyncDouble = withLogging(
    async (number) => number * 2,
    {
        level: "DEBUG",
        sink: (message) => logs.push(JSON.parse(message))
    }
);

assert.equal(await asyncDouble(10), 20);
assert.equal(logs[1].level, "DEBUG");

console.log("\nAsync function:", logs[1]);

// Режим запису тільки помилок
const divide = withLogging(
    (a, b) => {
        if (b === 0) {
            throw new Error("Division by zero");
        }

        return a / b;
    },
    {
        level: "ERROR",
        sink: (message) => logs.push(JSON.parse(message))
    }
);

assert.equal(divide(10, 2), 5);
assert.equal(logs.length, 2);

assert.throws(
    () => divide(10, 0),
    /Division by zero/
);

assert.equal(logs[2].level, "ERROR");

console.log("\nError log:", logs[2]);

// Перевірка помилки асинхронної функції
const asyncError = withLogging(
    async () => {
        throw new Error("Async error");
    },
    {
        level: "ERROR",
        sink: (message) => logs.push(JSON.parse(message))
    }
);

await assert.rejects(asyncError(), /Async error/);

// Власний формат логування та запис у консоль
const custom = withLogging(add, {
    level: "DEBUG",
    formatter: (entry) => {
        return `[${entry.level}] Result: ${entry.result}`;
    }
});

custom(10, 20);

// Запис у файл
const path = new URL("../logs/lab-09.log", import.meta.url);

await rm(path, { force: true });

const fileLogger = withLogging(add, {
    sink: createFileSink(path)
});

fileLogger(20, 30);

const fileEntry = JSON.parse(
    await readFile(path, "utf8")
);

assert.equal(fileEntry.result, 50);

console.log("\nFile logging: OK");

// Надсилання логів до HTTP-сервісу
const server = await startDeliveryApi(0);

const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
    const httpSink = createHttpLogSink(baseUrl);

    let pending;

    const remoteLogger = withLogging(add, {
        sink: (message) => {
            pending = httpSink(message);
            return pending;
        }
    });

    remoteLogger(40, 50);

    await pending;

    const response = await fetch(`${baseUrl}/logs`, {
        headers: {
            "X-API-Key": credentials.apiKey
        }
    });

    const remoteLogs = await response.json();

    assert.equal(remoteLogs[0].result, 90);

    console.log("HTTP logging: OK");

} finally {
    await new Promise((resolve) => {
        server.close(resolve);
    });
}

// Перевірка вимірювання часу
assert.ok(logs[0].duration >= 0);
assert.ok(logs[0].time);

console.log("Execution profiling: OK");
console.log("\nAll logging checks passed.");