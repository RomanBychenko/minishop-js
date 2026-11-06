import { EventBus } from "minishop-utils";

const shopEvents = new EventBus();

const notifications = [];

const stats = {
    created: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
};

function addNotification(message) {
    notifications.push({
        message,
        time: new Date().toISOString()
    });

    // Зберігаємо тільки останні 100 повідомлень
    if (notifications.length > 100) {
        notifications.shift();
    }
}

// Перший підписник відповідає за повідомлення
function notifyCreated(order) {
    addNotification(`Order #${order.id} created`);
}

const stopNotifications = shopEvents.subscribe(
    "order:created",
    notifyCreated
);

// Другий підписник оновлює статистику
shopEvents.subscribe("order:created", () => {
    stats.created++;
});

shopEvents.subscribe("order:completed", (order) => {
    stats.completed++;
    addNotification(`Order #${order.id} completed`);
});

shopEvents.subscribe("order:failed", (order) => {
    stats.failed++;
    addNotification(`Order #${order.id} failed`);
});

shopEvents.subscribe("order:cancelled", (order) => {
    stats.cancelled++;
    addNotification(`Order #${order.id} cancelled`);
});

function getNotifications() {
    return [...notifications];
}

function getStats() {
    return { ...stats };
}

export {
    shopEvents,
    getNotifications,
    getStats,
    stopNotifications
};