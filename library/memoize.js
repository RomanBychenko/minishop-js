import { selectEntry } from "./cachePolicies.js";

function memoize(fn, options = {}) {
    const {
        maxSize = Infinity,
        policy = "LRU",
        ttlMs = policy === "TTL" ? 5000 : Infinity,
        customEvict
    } = options;

    if (typeof fn !== "function") {
        throw new Error("Expected a function");
    }

    if (maxSize !== Infinity &&
        (!Number.isInteger(maxSize) || maxSize < 0)) {
        throw new Error("Invalid cache size");
    }

    if (!["LRU", "LFU", "TTL", "CUSTOM"].includes(policy)) {
        throw new Error("Unknown cache policy");
    }

    if (!(ttlMs > 0)) {
        throw new Error("Invalid cache expiration time");
    }

    if (policy === "CUSTOM" &&
        typeof customEvict !== "function") {
        throw new Error("Custom eviction function is required");
    }

    let cache = [];
    let hits = 0;
    let misses = 0;
    let sequence = 0;

    // Видаляємо записи, термін дії яких закінчився
    function removeExpired() {
        if (ttlMs !== Infinity) {
            const now = performance.now();

            cache = cache.filter((entry) => {
                return entry.expiresAt > now;
            });
        }
    }

    function memoized(...args) {
        removeExpired();

        // Шукаємо результат з такими самими аргументами
        const entry = cache.find((item) => {
            return item.args.length === args.length &&
                item.args.every((arg, i) => {
                    return Object.is(arg, args[i]);
                });
        });

        if (entry) {
            hits++;
            entry.hits++;
            entry.lastUsed = ++sequence;

            return entry.result;
        }

        misses++;

        const result = fn(...args);

        if (maxSize === 0) {
            return result;
        }

        // Якщо кеш заповнений, звільняємо місце
        if (cache.length >= maxSize) {
            const index = selectEntry(
                cache,
                policy,
                customEvict
            );

            cache.splice(index, 1);
        }

        cache.push({
            args,
            result,
            hits: 1,
            lastUsed: ++sequence,
            expiresAt: performance.now() + ttlMs
        });

        return result;
    }

    // Статистика використання кешу
    memoized.getStats = function () {
        removeExpired();

        return {
            size: cache.length,
            hits,
            misses
        };
    };

    memoized.clear = function () {
        cache = [];
        hits = 0;
        misses = 0;
    };

    return memoized;
}

export { memoize };