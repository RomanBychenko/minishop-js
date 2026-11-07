import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { startShopServer } from "../server.js";

const app = await startShopServer(0, 0);
const base = `http://127.0.0.1:${app.server.address().port}`;

async function request(path, body) {
    const response = await fetch(base + path, body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return result;
}

try {
    const html = await fetch(base);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /MiniShop/);
    const state = await request("/api/state");
    assert.equal(state.products.length, 6);

    const items = [{ productId: 5, quantity: 3 }];
    const low = await request("/api/orders", { items, priority: 1 });
    const high = await request("/api/orders", { items, priority: 3 });
    assert.equal(low.total, 2527.3);
    assert.equal((await request("/api/state?mode=highest")).next.id, high.id);
    assert.equal((await request("/api/state?mode=lowest")).next.id, low.id);

    for (const method of ["JWT", "OAUTH"]) {
        const result = await request("/api/process", { mode: "highest", method, count: 1 });
        assert.equal(result.completed, 1);
        assert.equal((await request("/api/state")).history[0].authMethod, method);
    }

    const generated = await request("/api/generate", { seconds: 1 });
    assert.ok(generated.count >= 1);
    for (let i = 0; i < 3; i++) await request("/api/orders", { items, priority: 2 });
    const processing = request("/api/process", { mode: "oldest", method: "API_KEY", count: 100 });
    // Чекаємо, поки сервер почне обробку, а потім скасовуємо її
    for (let i = 0; i < 50; i++) {
        if ((await request("/api/state")).busy === "processing") break;
        await delay(10);
    }
    assert.equal((await request("/api/cancel", {})).cancelled, true);
    assert.equal((await processing).status, "cancelled");
    assert.ok((await request("/api/state")).queue.length > 0);
    const next = await request("/api/process", { mode: "newest", method: "API_KEY", count: 1 });
    assert.equal(next.completed, 1);

    const stats = await request("/api/import-demo", { count: 1000 });
    assert.equal(stats.processed, 1000);
    const upload = await fetch(base + "/api/import-file", {
        method: "POST",
        body: '{"id":1,"productId":2,"quantity":3,"priority":1}\ninvalid\n'
    });
    assert.equal(upload.status, 200);
    const uploaded = await upload.json();
    assert.equal(uploaded.processed, 1);
    assert.equal(uploaded.invalid, 1);

    const end = await request("/api/state");
    assert.ok(end.cache.pricing.hits > 0);
    assert.ok(end.stats.completed >= 3);
    assert.ok(end.notifications.length > 0);
    assert.ok(end.requests.length >= 3);
    assert.ok((await request("/api/logs")).length > 0);
    console.log("All MiniShop integration checks passed.");
} finally {
    await app.close();
}
