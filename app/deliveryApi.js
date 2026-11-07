import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Тестові дані лише для локальної демонстрації
const credentials = {
    apiKey: "minishop-demo-key",
    clientId: "minishop",
    clientSecret: "demo-secret",
    jwtSecret: "minishop-jwt-demo-secret"
};

function encode(data) {
    return Buffer.from(JSON.stringify(data))
        .toString("base64url");
}

function sign(data) {
    return createHmac("sha256", credentials.jwtSecret)
        .update(data)
        .digest("base64url");
}

// Створюємо підписаний JWT
function createToken(seconds) {
    const header = encode({
        alg: "HS256",
        typ: "JWT"
    });

    const payload = encode({
        sub: credentials.clientId,
        exp: Math.floor(Date.now() / 1000) + seconds
    });

    const data = `${header}.${payload}`;

    return `${data}.${sign(data)}`;
}

// Перевіряємо підпис і термін дії JWT
function verifyToken(token) {
    try {
        const parts = token.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const [header, payload, signature] = parts;

        const expected = Buffer.from(sign(`${header}.${payload}`));
        const actual = Buffer.from(signature);

        if (expected.length !== actual.length ||
            !timingSafeEqual(expected, actual)) {
            return false;
        }

        const data = JSON.parse(
            Buffer.from(payload, "base64url").toString()
        );

        const meta = JSON.parse(
            Buffer.from(header, "base64url").toString()
        );

        return meta.alg === "HS256" &&
            data.sub === credentials.clientId &&
            Number.isFinite(data.exp) &&
            data.exp > Date.now() / 1000;
    } catch {
        return false;
    }
}

function sendJson(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

async function readBody(req) {
    let body = "";

    for await (const chunk of req) {
        body += chunk;

        if (Buffer.byteLength(body) > 65536) {
            throw new Error("Request too large");
        }
    }

    return JSON.parse(body || "{}");
}

// Запускаємо окремий сервіс доставки
async function startDeliveryApi(
    port = 3001,
    tokenLifetime = 30
) {
    const oauthTokens = new Map();
    const receivedLogs = [];

    function authenticate(req) {
        if (req.headers["x-api-key"] === credentials.apiKey) {
            return "API_KEY";
        }

        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) {
            return null;
        }

        const token = authorization.slice(7);

        if (verifyToken(token)) {
            return "JWT";
        }

        if (oauthTokens.get(token) > Date.now()) {
            return "OAUTH";
        }

        return null;
    }

    const server = createServer(async (req, res) => {
        try {
            const path = new URL(
                req.url,
                "http://localhost"
            ).pathname;

            // Видача токенів для JWT та OAuth
            if (req.method === "POST" &&
                ["/jwt/token", "/oauth/token"].includes(path)) {

                let body;

                if (path === "/oauth/token") {
                    let text = "";

                    for await (const chunk of req) {
                        text += chunk;

                        if (Buffer.byteLength(text) > 65536) {
                            throw new Error("Request too large");
                        }
                    }

                    body = Object.fromEntries(
                        new URLSearchParams(text)
                    );

                    if (body.grant_type !== "client_credentials") {
                        return sendJson(res, 400, {
                            error: "Unsupported grant type"
                        });
                    }
                } else {
                    body = await readBody(req);
                }

                if (body.client_id !== credentials.clientId ||
                    body.client_secret !== credentials.clientSecret) {

                    return sendJson(res, 401, {
                        error: "Invalid credentials"
                    });
                }

                let token;

                if (path === "/jwt/token") {
                    token = createToken(tokenLifetime);
                } else {
                    for (const [key, expires] of oauthTokens) {
                        if (expires <= Date.now()) {
                            oauthTokens.delete(key);
                        }
                    }

                    token = randomUUID();

                    oauthTokens.set(
                        token,
                        Date.now() + tokenLifetime * 1000
                    );
                }

                return sendJson(res, 200, {
                    access_token: token,
                    token_type: "Bearer",
                    expires_in: tokenLifetime
                });
            }

            const method = authenticate(req);

            if (!method) {
                return sendJson(res, 401, {
                    error: "Unauthorized"
                });
            }

            if (req.method === "POST" && path === "/delivery") {
                const order = await readBody(req);

                if (!Number.isInteger(order.id)) {
                    return sendJson(res, 400, {
                        error: "Invalid order"
                    });
                }

                return sendJson(res, 200, {
                    accepted: true,
                    orderId: order.id,
                    authMethod: method
                });
            }

            // Сервіс приймання логів для наступної лабораторної
            if (path === "/logs" && req.method === "POST") {
                const entry = await readBody(req);

                receivedLogs.push(entry);

                if (receivedLogs.length > 100) {
                    receivedLogs.shift();
                }

                return sendJson(res, 201, {
                    accepted: true
                });
            }

            if (path === "/logs" && req.method === "GET") {
                return sendJson(res, 200, receivedLogs);
            }

            sendJson(res, 404, {
                error: "Not found"
            });

        } catch {
            sendJson(res, 400, {
                error: "Invalid request"
            });
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);

        server.listen(port, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });

    return server;
}

export { credentials, startDeliveryApi };