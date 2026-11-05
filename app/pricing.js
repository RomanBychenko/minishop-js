import { memoize } from "minishop-utils";

// Розрахунок вартості товару з урахуванням знижки
const calculateTotal = memoize(
    (price, quantity, discount = 0) => {
        const total = price * quantity;

        return Math.round(
            total * (1 - discount / 100) * 100
        ) / 100;
    },
    {
        maxSize: 100,
        policy: "LRU"
    }
);

// Безкоштовна доставка для замовлень від 5000 грн
const calculateDelivery = memoize(
    (total) => {
        if (total >= 5000) {
            return 0;
        }

        return 100;
    },
    {
        maxSize: 50,
        policy: "LFU"
    }
);

export { calculateTotal, calculateDelivery };