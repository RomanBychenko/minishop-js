class PriorityQueue {
    constructor() {
        this.items = [];
    }

    // Додаємо елемент до черги
    enqueue(item, priority = 0) {
        if (!Number.isFinite(priority)) {
            throw new Error("Invalid priority");
        }

        this.items.push({
            item,
            priority
        });
    }

    // Знаходимо індекс потрібного елемента
    findIndex(mode) {
        const modes = [
            "highest",
            "lowest",
            "oldest",
            "newest"
        ];

        if (!modes.includes(mode)) {
            throw new Error("Unknown queue mode");
        }

        if (this.items.length === 0) {
            return -1;
        }

        if (mode === "oldest") {
            return 0;
        }

        if (mode === "newest") {
            return this.items.length - 1;
        }

        let index = 0;

        for (let i = 1; i < this.items.length; i++) {
            const current = this.items[i].priority;
            const selected = this.items[index].priority;

            if (mode === "highest" && current > selected) {
                index = i;
            }

            if (mode === "lowest" && current < selected) {
                index = i;
            }
        }

        return index;
    }

    // Переглядаємо елемент без видалення
    peek(mode = "highest") {
        const index = this.findIndex(mode);

        if (index === -1) {
            return undefined;
        }

        return this.items[index].item;
    }

    // Отримуємо та видаляємо елемент
    dequeue(mode = "highest") {
        const index = this.findIndex(mode);

        if (index === -1) {
            return undefined;
        }

        const removed = this.items.splice(index, 1);

        return removed[0].item;
    }

    get size() {
        return this.items.length;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    toArray() {
        return this.items.map((entry) => entry.item);
    }
}

export { PriorityQueue };