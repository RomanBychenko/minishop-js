class AuthProxy {
    constructor(baseUrl, strategies, options = {}) {
        this.baseUrl = baseUrl;
        this.strategies = strategies;
        this.strategy = options.strategy || "API_KEY";

        this.maxRequests = options.maxRequests ?? 100;
        this.windowMs = options.windowMs ?? 1000;
        this.logger = options.logger || (() => {});

        this.requestCount = 0;
        this.windowStart = Date.now();

        this.setStrategy(this.strategy);
    }

    // Змінюємо спосіб авторизації
    setStrategy(name) {
        if (!Object.hasOwn(this.strategies, name)) {
            throw new Error("Unknown authentication strategy");
        }

        this.strategy = name;
    }

    // Обмеження кількості запитів
    checkLimit() {
        const now = Date.now();

        if (now - this.windowStart >= this.windowMs) {
            this.windowStart = now;
            this.requestCount = 0;
        }

        if (this.requestCount >= this.maxRequests) {
            throw new Error("Rate limit exceeded");
        }

        this.requestCount++;
    }

    async request(path, options = {}) {
        const url = new URL(path, this.baseUrl);

        // Не передаємо ключі на сторонні сервери
        if (url.origin !== new URL(this.baseUrl).origin) {
            throw new Error("Invalid API address");
        }

        const name = this.strategy;
        const strategy = this.strategies[name];

        const method = options.method || "GET";

        const send = async (renew = false) => {
            this.checkLimit();

            const headers = new Headers(options.headers);

            const authHeaders = await strategy.headers(renew);

            for (const [key, value] of Object.entries(authHeaders)) {
                headers.set(key, value);
            }

            const response = await fetch(url, {
                ...options,
                headers,
                redirect: "error"
            });

            // Не записуємо секретні ключі в журнал
            this.logger({
                method,
                path: url.pathname,
                status: response.status,
                strategy: name,
                time: new Date().toISOString()
            });

            return response;
        };

        let response = await send();

        // Повторно отримуємо токен, якщо його відхилено
        if (response.status === 401 &&
            strategy.renewable &&
            (options.body === undefined ||
             typeof options.body === "string")) {

            await response.body?.cancel();

            response = await send(true);
        }

        return response;
    }
}

export { AuthProxy };