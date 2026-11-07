import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { withLogging } from "minishop-utils";
import { credentials } from "./deliveryApi.js";

const logPath = new URL("./logs/shop.log", import.meta.url);

// Запис у звичайний файл
function createFileSink(path = logPath) {
    const file = path instanceof URL
        ? fileURLToPath(path)
        : path;

    return (message) => {
        mkdirSync(dirname(file), {
            recursive: true
        });

        appendFileSync(file, message + "\n");
    };
}

// Надсилання логів до іншого HTTP-сервісу
function createHttpLogSink(
    baseUrl = "http://127.0.0.1:3001"
) {
    return async (message) => {
        let data;

        try {
            data = JSON.parse(message);
        } catch {
            data = { message };
        }

        const response = await fetch(`${baseUrl}/logs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": credentials.apiKey
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("Cannot send log");
        }

        return response.json();
    };
}

function logFunction(fn, level = "INFO") {
    return withLogging(fn, {
        level,
        sink: createFileSink()
    });
}

export {
    createFileSink,
    createHttpLogSink,
    logFunction
};