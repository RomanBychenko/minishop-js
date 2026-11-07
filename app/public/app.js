const $ = (id) => document.getElementById(id);
const money = (value) => Number(value).toLocaleString("uk-UA", {
    style: "currency", currency: "UAH"
});

let products = [];
const cart = new Map();
let state = null;
let loading = false;
let localBusy = false;

async function api(path, body) {
    const options = body === undefined ? {} : {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    };
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Помилка запиту");
    return data;
}

function message(text, error = false) {
    $("message").textContent = text;
    $("message").className = error ? "error" : "";
}

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function button(text, action, className) {
    const node = element("button", text, className);
    node.addEventListener("click", action);
    return node;
}

function renderProducts() {
    $("products").replaceChildren();
    for (const product of products) {
        const card = element("article", undefined, "product");
        card.append(
            element("div", product.icon, "product-icon"),
            element("h3", product.name),
            element("strong", money(product.price)),
            button("До кошика", () => changeCart(product.id, 1))
        );
        $("products").append(card);
    }
}

function changeCart(id, change) {
    const quantity = (cart.get(id) || 0) + change;
    if (quantity > 99) return;
    if (quantity <= 0) cart.delete(id);
    else cart.set(id, quantity);
    renderCart();
}

function renderCart() {
    const list = $("cart-items");
    list.replaceChildren();
    let total = 0;
    let count = 0;
    for (const [id, quantity] of cart) {
        const product = products.find((p) => p.id === id);
        const line = element("div", undefined, "cart-line");
        const controls = element("div");
        controls.append(button("−", () => changeCart(id, -1), "secondary"),
            button("+", () => changeCart(id, 1), "secondary"));
        line.append(element("span", `${product.name} × ${quantity}`), controls);
        list.append(line);
        total += Math.round(product.price * quantity * (quantity >= 3 ? .9 : 1) * 100) / 100;
        count += quantity;
    }
    if (!count) list.append(element("p", "Кошик порожній", "muted"));
    if (count && total < 5000) total += 100;
    $("cart-count").textContent = count;
    $("cart-total").textContent = money(total);
    updateButtons();
}

function updateButtons() {
    const busy = localBusy || Boolean(state?.busy);
    for (const id of ["generate", "process", "import-demo", "import-file"]) {
        $(id).disabled = busy;
    }
    $("checkout").disabled = busy || cart.size === 0;
    $("process").disabled = busy || !state?.queue.length;
    $("cancel").disabled = state?.busy !== "processing";
}

function renderTable(id, rows, emptyColumns) {
    const table = $(id);
    table.replaceChildren();
    if (!rows.length) {
        const tr = element("tr");
        const td = element("td", "Поки немає записів", "muted");
        td.colSpan = emptyColumns;
        tr.append(td);
        table.append(tr);
    }
    for (const row of rows) {
        const tr = element("tr");
        for (const cell of row) tr.append(element("td", cell));
        table.append(tr);
    }
}

function orderNames(order) {
    return order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ");
}

function renderEntries(id, lines) {
    const list = $(id);
    list.replaceChildren();
    for (const line of lines) list.append(element("p", line));
    if (!lines.length) list.append(element("p", "Поки немає записів", "muted"));
}

function renderState() {
    if (!products.length) {
        products = state.products;
        renderProducts();
        renderCart();
    }
    $("server-status").textContent = state.busy ? "Виконується операція" : "Сервер працює";
    $("created").textContent = state.stats.created;
    $("queued").textContent = state.queue.length;
    $("completed").textContent = state.stats.completed;
    $("failed").textContent = `${state.stats.failed} / ${state.stats.cancelled}`;
    $("next-order").textContent = state.next ? `Наступне замовлення (peek): #${state.next.id}` : "Черга порожня";
    renderTable("queue", state.queue.map((order) => [
        `#${order.id}`, orderNames(order), order.priority, money(order.total), "Очікує"
    ]), 5);
    renderTable("history", state.history.map((order) => [
        `#${order.id}`, orderNames(order), money(order.total),
        order.status === "completed" ? "Завершено" : "Помилка", order.authMethod || "—"
    ]), 5);
    $("cache").textContent = JSON.stringify(state.cache, null, 2);
    if (state.importStats) $("import-result").textContent = JSON.stringify(state.importStats, null, 2);
    renderEntries("notifications", state.notifications.map((entry) =>
        `${new Date(entry.time).toLocaleTimeString()} · ${entry.message}`));
    renderEntries("requests", state.requests.map((entry) =>
        `${entry.method} ${entry.path} · ${entry.status} · ${entry.strategy}`));
    updateButtons();
}

async function refresh() {
    if (loading) return;
    loading = true;
    try {
        state = await api(`/api/state?mode=${$("mode").value}`);
        renderState();
    } catch (error) {
        $("server-status").textContent = "Сервер недоступний";
    } finally {
        loading = false;
    }
}

async function refreshLogs() {
    try {
        const logs = await api("/api/logs");
        $("log-output").textContent = logs.length
            ? logs.map((entry) => JSON.stringify(entry)).join("\n\n")
            : "Журнал порожній.";
    } catch (error) {
        message(error.message, true);
    }
}

async function run(action) {
    if (localBusy) return;
    localBusy = true;
    updateButtons();
    try {
        const text = await action();
        message(text);
    } catch (error) {
        message(error.message, true);
    } finally {
        localBusy = false;
        await refresh();
        updateButtons();
    }
}

$("checkout").addEventListener("click", () => run(async () => {
    const order = await api("/api/orders", {
        items: Array.from(cart, ([productId, quantity]) => ({ productId, quantity })),
        priority: Number($("priority").value)
    });
    cart.clear();
    renderCart();
    return `Замовлення #${order.id} створено.`;
}));
$("generate").addEventListener("click", () => run(async () => {
    const result = await api("/api/generate", { seconds: Number($("seconds").value) });
    return `Створено замовлень: ${result.count}.`;
}));
$("mode").addEventListener("change", refresh);
$("process").addEventListener("click", () => run(async () => {
    const result = await api("/api/process", {
        mode: $("mode").value, method: $("auth").value, count: Number($("batch").value)
    });
    await refreshLogs();
    return `Оброблено: ${result.completed}. ${result.status === "cancelled" ? "Операцію скасовано." : "Готово."}`;
}));
$("cancel").addEventListener("click", async () => {
    try {
        const result = await api("/api/cancel", {});
        message(result.cancelled ? "Скасування обробки..." : "Немає активної обробки.");
    } catch (error) { message(error.message, true); }
});
$("import-demo").addEventListener("click", () => run(async () => {
    const result = await api("/api/import-demo", { count: Number($("import-count").value) });
    $("import-result").textContent = JSON.stringify(result, null, 2);
    return `Імпортовано записів: ${result.processed}.`;
}));
$("import-file").addEventListener("click", () => run(async () => {
    const file = $("file").files[0];
    if (!file) throw new Error("Спочатку вибери JSONL-файл");
    const response = await fetch("/api/import-file", { method: "POST", body: file });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    $("import-result").textContent = JSON.stringify(data, null, 2);
    return `Імпортовано записів: ${data.processed}.`;
}));
$("refresh-logs").addEventListener("click", refreshLogs);

refresh();
refreshLogs();
// Оновлюємо стан, поки сервер обробляє замовлення
setInterval(refresh, 500);
