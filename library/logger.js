function withLogging(fn, options = {}) {
    const {
        level = "INFO",
        sink = console.log,
        formatter = (entry) => JSON.stringify(entry)
    } = options;

    if (typeof fn !== "function") {
        throw new Error("Expected a function");
    }

    if (!["INFO", "DEBUG", "ERROR"].includes(level)) {
        throw new Error("Unknown log level");
    }

    // Записуємо повідомлення у вибране місце
    function write(entry) {
        try {
            const result = sink(formatter(entry));

            // Підтримка асинхронного запису логів
            if (result && typeof result.catch === "function") {
                result.catch((error) => {
                    console.error("Logging failed:", error.message);
                });
            }
        } catch (error) {
            console.error("Logging failed:", error.message);
        }
    }

    return function (...args) {
        const start = performance.now();

        function success(result) {
            if (level !== "ERROR") {
                write({
                    time: new Date().toISOString(),
                    level,
                    function: fn.name || "anonymous",
                    args,
                    result,
                    duration: performance.now() - start
                });
            }

            return result;
        }

        function failure(error) {
            write({
                time: new Date().toISOString(),
                level: "ERROR",
                function: fn.name || "anonymous",
                args,
                error: error?.message || String(error),
                duration: performance.now() - start
            });

            throw error;
        }

        try {
            const result = fn.apply(this, args);

            // Якщо функція асинхронна
            if (result && typeof result.then === "function") {
                return Promise.resolve(result).then(
                    success,
                    failure
                );
            }

            return success(result);

        } catch (error) {
            return failure(error);
        }
    };
}

export { withLogging };