// Нескінченний генератор чисел
function* counter(start = 1) {
    let number = start;

    while (true) {
        yield number;
        number++;
    }
}

// Генератор тестових замовлень магазину
function* orderGenerator(start = 1001) {
    const ids = counter(start);

    while (true) {
        yield {
            id: ids.next().value,
            productId: Math.floor(Math.random() * 6) + 1,
            quantity: Math.floor(Math.random() * 3) + 1,
            priority: Math.floor(Math.random() * 3) + 1,
            status: "pending"
        };
    }
}

export { counter, orderGenerator };