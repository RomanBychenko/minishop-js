import {
    counter,
    orderGenerator,
    consumeFor
} from "minishop-utils";

console.log("Lab 1 - Generators and Iterators");

const numbers = counter(1);

console.log("\nCounter:");

for (let i = 0; i < 5; i++) {
    console.log(numbers.next().value);
}

console.log("\nGenerated orders:");

const orders = orderGenerator();

const count = await consumeFor(orders, 2, (order) => {
    console.log(order);
});

console.log("\nTotal orders:", count);