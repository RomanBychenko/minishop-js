import { setTimeout as delay } from "node:timers/promises";

// Обробляємо значення, поки не закінчиться час
async function consumeFor(
    iterator,
    seconds,
    onValue = console.log,
    delayMs = 250
) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new Error("Invalid timeout");
    }

    const endTime = performance.now() + seconds * 1000;
    let count = 0;

    while (performance.now() < endTime) {
        const result = iterator.next();

        if (result.done) {
            break;
        }

        await onValue(result.value);
        count++;

        // Затримка, щоб не створювати надто багато записів
        const remaining = endTime - performance.now();

        if (remaining > 0) {
            await delay(Math.min(delayMs, remaining));
        }
    }

    return count;
}

export { consumeFor };