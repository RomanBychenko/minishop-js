import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { startDeliveryApi } from "./deliveryApi.js";
import { createShop } from "./shop.js";

function json(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

async function readBody(req) {
    let body = "";
    for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 65536) throw new Error("Занадто великий запит");
    }
    return JSON.parse(body || "{}");
}

const staticFiles = {
    "/": ["index.html", "text/html"],
    "/style.css": ["style.css", "text/css"],
    "/app.js": ["app.js", "text/javascript"]
};

async function startShopServer(port = 3000, deliveryPort = 3001) {
    const deliveryServer = await startDeliveryApi(deliveryPort);
    const shop = createShop(`http://127.0.0.1:${deliveryServer.address().port}`);

    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, "http://localhost");
            const path = url.pathname;

            if (req.method === "GET") {
                if (path === "/api/state") {
                    return json(res, 200, shop.getState(url.searchParams.get("mode") || "highest"));
                }
                if (path === "/api/logs") return json(res, 200, await shop.getLogs());
                if (Object.hasOwn(staticFiles, path)) {
                    const [name, type] = staticFiles[path];
                    const file = await readFile(new URL(`./public/${name}`, import.meta.url));
                    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
                    return res.end(file);
                }
            }

            if (req.method === "POST") {
                if (path === "/api/import-file") {
                    return json(res, 200, await shop.importUpload(req));
                }
                const body = await readBody(req);
                if (path === "/api/orders") return json(res, 201, shop.checkout(body.items, body.priority));
                if (path === "/api/generate") return json(res, 200, { count: await shop.generate(body.seconds) });
                if (path === "/api/process") return json(res, 200, await shop.process(body.mode, body.method, body.count));
                if (path === "/api/cancel") return json(res, 200, { cancelled: shop.cancel() });
                if (path === "/api/import-demo") return json(res, 200, await shop.importDemo(body.count));
            }
            json(res, 404, { error: "Сторінку не знайдено" });
        } catch (error) {
            if (!res.headersSent && !res.destroyed) json(res, 400, { error: error.message });
        }
    });

    try {
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, "127.0.0.1", resolve);
        });
    } catch (error) {
        deliveryServer.close();
        throw error;
    }

    async function close() {
        shop.cancel();
        await Promise.all([server, deliveryServer].map((item) =>
            new Promise((resolve) => item.close(resolve))
        ));
    }

    return { server, deliveryServer, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { server, deliveryServer } = await startShopServer();
    console.log(`MiniShop: http://127.0.0.1:${server.address().port}`);
    console.log(`Delivery API: http://127.0.0.1:${deliveryServer.address().port}`);
}

export { startShopServer };
