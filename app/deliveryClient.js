import { AuthProxy } from "minishop-utils";
import { credentials } from "./deliveryApi.js";

// Стратегія отримання та оновлення токенів
function tokenStrategy(baseUrl, type) {
    let token = null;
    let expiresAt = 0;

    return {
        renewable: true,

        async headers(renew = false) {
            if (renew || !token || Date.now() >= expiresAt) {
                const data = {
                    client_id: credentials.clientId,
                    client_secret: credentials.clientSecret
                };

                const oauth = type === "oauth";

                if (oauth) {
                    data.grant_type = "client_credentials";
                }

                const response = await fetch(
                    `${baseUrl}/${type}/token`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": oauth
                                ? "application/x-www-form-urlencoded"
                                : "application/json"
                        },
                        body: oauth
                            ? new URLSearchParams(data).toString()
                            : JSON.stringify(data)
                    }
                );

                if (!response.ok) {
                    throw new Error("Cannot receive token");
                }

                const result = await response.json();

                token = result.access_token;

                expiresAt = Date.now() +
                    result.expires_in * 1000 - 100;
            }

            return {
                Authorization: `Bearer ${token}`
            };
        }
    };
}

function createDeliveryClient(
    baseUrl = "http://127.0.0.1:3001",
    options = {}
) {
    const strategies = {
        API_KEY: {
            headers() {
                return {
                    "X-API-Key": credentials.apiKey
                };
            }
        },

        JWT: tokenStrategy(baseUrl, "jwt"),

        OAUTH: tokenStrategy(baseUrl, "oauth")
    };

    return new AuthProxy(baseUrl, strategies, options);
}

// Надсилаємо замовлення до сервісу доставки
async function sendOrder(client, order, signal) {
    const response = await client.request("/delivery", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(order),
        signal
    });

    if (!response.ok) {
        throw new Error(`Delivery error: ${response.status}`);
    }

    return response.json();
}

export { createDeliveryClient, sendOrder };