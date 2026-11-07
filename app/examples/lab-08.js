import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import {
    startDeliveryApi
} from "../deliveryApi.js";

import {
    createDeliveryClient,
    sendOrder
} from "../deliveryClient.js";

console.log("Lab 8 - Authentication Proxy\n");

// Порт 0 дозволяє автоматично вибрати вільний порт
const server = await startDeliveryApi(0, 2);

const baseUrl = `http://127.0.0.1:${server.address().port}`;

const logs = [];

const client = createDeliveryClient(baseUrl, {
    logger: (entry) => {
        logs.push(entry);
    }
});

try {
    const order = {
        id: 1001,
        quantity: 2
    };

    // Запит без авторизації
    const unauthorized = await fetch(`${baseUrl}/delivery`, {
        method: "POST"
    });

    assert.equal(unauthorized.status, 401);

    console.log("Without authorization: 401");

    // Перевіряємо три способи авторизації
    for (const method of ["API_KEY", "JWT", "OAUTH"]) {
        client.setStrategy(method);

        const result = await sendOrder(client, order);

        assert.equal(result.accepted, true);
        assert.equal(result.authMethod, method);

        console.log(method + ":", result);
    }

    // Перевіряємо оновлення OAuth-токена
    client.setStrategy("OAUTH");

    const before = await client.strategies.OAUTH.headers();

    await delay(2200);

    const after = await client.strategies.OAUTH.headers();

    assert.notEqual(
        before.Authorization,
        after.Authorization
    );

    const renewed = await sendOrder(client, order);

    assert.equal(renewed.accepted, true);

    console.log("\nToken renewal: OK");

    // Перевіряємо обмеження запитів
    const limited = createDeliveryClient(baseUrl, {
        maxRequests: 1,
        windowMs: 10000
    });

    await sendOrder(limited, order);

    await assert.rejects(
        sendOrder(limited, order),
        /Rate limit exceeded/
    );

    console.log("Rate limiting: OK");

    assert.throws(
        () => client.setStrategy("UNKNOWN"),
        /Unknown authentication/
    );

    assert.ok(logs.length >= 4);

    console.log("\nRequest logs:", logs);

    console.log("\nAll authentication checks passed.");

} finally {
    await new Promise((resolve) => {
        server.close(resolve);
    });
}