import { EventEmitter } from "node:events";

class EventBus {
    constructor() {
        this.emitter = new EventEmitter();
    }

    // Підписка на подію
    subscribe(event, listener) {
        this.emitter.on(event, listener);

        return () => {
            this.unsubscribe(event, listener);
        };
    }

    // Видалення підписника
    unsubscribe(event, listener) {
        this.emitter.off(event, listener);
    }

    // Надсилання повідомлення підписникам
    publish(event, data) {
        return this.emitter.emit(event, data);
    }

    listenerCount(event) {
        return this.emitter.listenerCount(event);
    }
}

export { EventBus };