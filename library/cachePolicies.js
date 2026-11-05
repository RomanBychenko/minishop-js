// Вибираємо елемент, який потрібно видалити з кешу
function selectEntry(cache, policy, customEvict) {
    let index = 0;

    if (policy === "CUSTOM") {
        const selected = customEvict(cache);

        if (!Number.isInteger(selected) ||
            selected < 0 || selected >= cache.length) {
            throw new Error("Invalid cache index");
        }

        return selected;
    }

    for (let i = 1; i < cache.length; i++) {
        const current = cache[i];
        const selected = cache[index];

        if (policy === "LRU") {
            if (current.lastUsed < selected.lastUsed) {
                index = i;
            }
        }

        if (policy === "LFU") {
            if (current.hits < selected.hits) {
                index = i;
            } else if (current.hits === selected.hits &&
                       current.lastUsed < selected.lastUsed) {
                index = i;
            }
        }

        if (policy === "TTL") {
            if (current.expiresAt < selected.expiresAt) {
                index = i;
            }
        }
    }

    return index;
}

export { selectEntry };