const state = {
  menu: [],
  cart: [],
  staff: false
};

const $ = id => document.getElementById(id);

function euro(value) {
  return "";
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Es ist ein Fehler aufgetreten.");
  return data;
}

function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

function renderMenu() {
  $("menuGrid").innerHTML = state.menu.map(product => `
    <article class="menu-card">
      <div>
        <div class="menu-top">
          <h3>${product.name}</h3>
          <span class="price">kostenlos</span>
        </div>
        ${product.variants
          ? `<select class="variant" id="variant-${product.id}">
              ${product.variants.map(v => `<option value="${v}">${v}</option>`).join("")}
             </select>`
          : `<p>Frisch in der Mensa erhältlich.</p>`
        }
      </div>
      <div class="add-row">
        <input class="qty" id="qty-${product.id}" type="number" min="1" max="20" value="1">
        <button class="button dark add-btn" onclick="addToCart('${product.id}')">Hinzufügen</button>
      </div>
    </article>
  `).join("");
}

window.addToCart = function(id) {
  const product = state.menu.find(p => p.id === id);
  const quantity = Math.max(1, Math.min(20, Number($(`qty-${id}`).value) || 1));
  const variant = product.variants ? $(`variant-${id}`).value : null;

  const existing = state.cart.find(item => item.id === id && item.variant === variant);
  if (existing) existing.quantity += quantity;
  else state.cart.push({ id, name: product.name, price: product.price, variant, quantity });

  renderCart();
  showToast(`${product.name} wurde hinzugefügt.`);
};

function renderCart() {
  const totalQuantity = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  $("cartCount").textContent = totalQuantity;

  if (!state.cart.length) {
    $("cartItems").innerHTML = `<p class="muted">Noch nichts ausgewählt.</p>`;
    $("total").textContent = euro(0);
    $("orderButton").disabled = true;
    return;
  }

  $("cartItems").innerHTML = state.cart.map((item, index) => `
    <div class="cart-line">
      <div>
        <strong>${item.quantity}× ${item.name}</strong>
        ${item.variant ? `<small>${item.variant}</small>` : ""}
      </div>
      <div>

        <button class="remove" onclick="removeCart(${index})">×</button>
      </div>
    </div>
  `).join("");

  $("total").textContent = "Kostenlos";
  $("orderButton").disabled = false;
}

window.removeCart = function(index) {
  state.cart.splice(index, 1);
  renderCart();
};

async function updateQueue() {
  try {
    const data = await api("/api/status");
    const count = data.queueCount;
    $("queueCount").textContent = count;

    // 0-10 Personen = visualisierte Skala; 7+ bleibt bei 100%.
    $("queueBar").style.width = `${Math.min(count / 10 * 100, 100)}%`;
    $("queueBar").style.background =
      data.queue.color === "green" ? "var(--green)" :
      data.queue.color === "yellow" ? "var(--yellow)" : "var(--red)";

    $("queueLevel").textContent =
      data.queue.level === "green" ? "Gering" :
      data.queue.level === "mittel" ? "Mittel" : "Hoch";
    $("queueLevel").className = `badge ${data.queue.color}`;
    $("queueDescription").textContent = data.queue.label;
    $("lastUpdate").textContent = new Date().toLocaleTimeString("de-DE");
  } catch (err) {
    $("lastUpdate").textContent = "keine Verbindung";
  }
}

async function submitOrder() {
  if (!state.cart.length) return;

  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: $("customerName").value,
        items: state.cart
      })
    });

    state.cart = [];
    renderCart();
    $("customerName").value = "";

    showToast(`Bestellung #${result.orderNumber} wurde aufgenommen.`);
    setTimeout(() => {
      alert(`Bestellung erfolgreich!\n\nDeine Bestellnummer: #${result.orderNumber}\n\nMerke dir diese Nummer für die Abholung.`);
    }, 100);
  } catch (err) {
    showToast(err.message);
  }
}

async function staffLogin() {
  try {
    await api("/api/staff/login", {
      method: "POST",
      body: JSON.stringify({ password: $("staffPassword").value })
    });
    $("staffPassword").value = "";
    $("loginMessage").textContent = "";
    await checkStaff();
    showToast("Mitarbeiterbereich geöffnet.");
  } catch (err) {
    $("loginMessage").textContent = err.message;
  }
}

async function checkStaff() {
  const data = await api("/api/staff/me");
  state.staff = data.loggedIn;
  $("loginBox").classList.toggle("hidden", state.staff);
  $("staffPanel").classList.toggle("hidden", !state.staff);
  if (state.staff) await loadStaffOrders();
}

async function loadStaffOrders() {
  if (!state.staff) return;
  try {
    const orders = await api("/api/staff/orders");
    $("staffCount").textContent = `${orders.length} insgesamt`;

    if (!orders.length) {
      $("ordersTableWrap").innerHTML = `<p class="muted">Noch keine Bestellungen.</p>`;
      return;
    }

    $("ordersTableWrap").innerHTML = `
      <div style="overflow:auto">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Nr.</th><th>Name</th><th>Bestellung</th><th>Summe</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td class="order-no">#${order.number}</td>
              <td>${escapeHtml(order.customerName || "–")}</td>
              <td>${order.items.map(i => `${i.quantity}× ${escapeHtml(i.name)}${i.variant ? ` (${escapeHtml(i.variant)})` : ""}`).join("<br>")}</td>
              <td>${euro(order.total)}</td>
              <td>
                <select class="status-select" id="status-${order.number}">
                  ${["neu", "in_zubereitung", "abholbereit", "abgeschlossen"].map(s =>
                    `<option value="${s}" ${s === order.status ? "selected" : ""}>${statusLabel(s)}</option>`
                  ).join("")}
                </select>
              </td>
              <td><button class="button small dark" onclick="saveStatus(${order.number})">Speichern</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      </div>
    `;
  } catch (err) {
    if (err.message.includes("angemeldet")) await checkStaff();
    else showToast(err.message);
  }
}

function statusLabel(status) {
  return {
    neu: "Neu",
    in_zubereitung: "In Zubereitung",
    abholbereit: "Abholbereit",
    abgeschlossen: "Abgeschlossen"
  }[status] || status;
}

window.saveStatus = async function(number) {
  const status = $(`status-${number}`).value;
  try {
    await api(`/api/staff/orders/${number}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    showToast(`Bestellung #${number}: ${statusLabel(status)}`);
    await loadStaffOrders();
  } catch (err) {
    showToast(err.message);
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

async function logout() {
  await api("/api/staff/logout", { method: "POST" });
  state.staff = false;
  await checkStaff();
  showToast("Abgemeldet.");
}

$("orderButton").addEventListener("click", submitOrder);
$("loginButton").addEventListener("click", staffLogin);
$("staffPassword").addEventListener("keydown", e => {
  if (e.key === "Enter") staffLogin();
});
$("refreshOrders").addEventListener("click", loadStaffOrders);
$("logoutButton").addEventListener("click", logout);

async function init() {
  state.menu = await api("/api/menu");
  renderMenu();
  renderCart();
  await updateQueue();
  await checkStaff();
  setInterval(updateQueue, 2000);
  setInterval(() => { if (state.staff) loadStaffOrders(); }, 5000);
}

init().catch(err => showToast(err.message));
