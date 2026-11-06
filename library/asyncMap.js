function asyncMapCallback(items, mapper, callback, options = {}) {
    const { signal } = options;
    const results = [];

    let index = 0;
    let finished = false;

    function finish(error, result) {
        if (finished) {
            return;
        }

        finished = true;

        signal?.removeEventListener("abort", abort);
        callback(error, result);
    }

    function abort() {
        finish(new Error("Operation aborted"));
    }

    // Обробляємо елементи масиву по черзі
    function next() {
        if (finished) {
            return;
        }

        if (signal?.aborted) {
            abort();
            return;
        }

        if (index >= items.length) {
            finish(null, results);
            return;
        }

        const currentIndex = index;
        let called = false;

        function done(error, value) {
            if (finished || called) {
                return;
            }

            called = true;

            if (error) {
                finish(error);
                return;
            }

            results.push(value);
            index++;

            queueMicrotask(next);
        }

        try {
            mapper(items[currentIndex], currentIndex, done, signal);
        } catch (error) {
            done(error);
        }
    }

    signal?.addEventListener("abort", abort, { once: true });

    queueMicrotask(next);
}

export { asyncMapCallback };