import { counter, orderGenerator } from "../generator.js";
import { consumeFor } from "../iterator.js";

console.log("Lab 1 - Generators and Iterators");

// Перевірка звичайного генератора
const numbers = counter(1);

console.log("\nCounter:");

for (let i = 0; i < 5; i++) {
    console.log(numbers.next().value);
}

// Генеруємо замовлення протягом двох секунд
console.log("\nGenerated orders:");

const orders = orderGenerator();

const count = await consumeFor(orders, 2, (order) => {
    console.log(order);
});

console.log("\nTotal orders:", count);