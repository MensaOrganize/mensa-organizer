const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "mensa2026";
const DATA_FILE = path.join(__dirname, "data.json");

// Preise werden ausschließlich auf dem Server festgelegt.
// So kann ein Nutzer im Browser keine Preise manipulieren.
const MENU = [
  { id: "leberkaes", name: "Leberkässemmel", price: 2.30, variants: ["Ketchup", "Senf", "Ohne Sauce"], image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/" },
  { id: "schnitzel", name: "Schnitzelsemmel", price: 3.80, variants: ["Mit Salat", "Ohne Salat"], image: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/" },
  { id: "hamburger", name: "Hamburger", price: 4.00, variants: ["Mit Sauce", "Ohne Sauce"], image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/photos/burger-with-fries-on-plate-eHLMHx2gohs" },
  { id: "cheeseburger", name: "Cheeseburger", price: 4.00, variants: ["Mit Sauce", "Ohne Sauce"], image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/photos/burger-on-white-ceramic-plate-g1MG9i0ux8Y" },
  { id: "chickenburger", name: "Chickenburger", price: 3.80, variants: ["Mit Sauce", "Ohne Sauce"], image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/s/photos/chicken-burger" },
  { id: "pizza", name: "Pizzastück", price: 3.00, variants: ["Margherita", "Salami", "Schinken"], image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/photos/a-person-making-pizzas-T_PbUhfwd0U" },
  { id: "donut", name: "Donut", price: 1.50, variants: ["Erdbeer", "Schokolade", "Vanille"], image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/photos/a-donut-with-a-bite-taken-out-of-it-5SX-Od-VVtY" },
  { id: "muffin", name: "Muffin", price: 2.40, variants: null, image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/" },
  { id: "cookie", name: "Cookie", price: 1.60, variants: ["Hell", "Dunkel"], image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=85", imageSource: "https://unsplash.com/" }
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "mensa-organizer-demo-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { nextOrderNumber: 1, queueCount: 0, orders: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function requireStaff(req, res, next) {
  if (req.session.staff) return next();
  res.status(401).json({ error: "Nicht angemeldet." });
}

function getQueueInfo(count) {
  if (count <= 4) return { level: "gering", label: "Geringe Auslastung", color: "green" };
  if (count <= 6) return { level: "mittel", label: "Mittlere Auslastung", color: "yellow" };
  return { level: "hoch", label: "Hohe Auslastung", color: "red" };
}

app.get("/api/menu", (req, res) => res.json(MENU));

app.get("/api/status", (req, res) => {
  const data = loadData();
  res.json({
    queueCount: data.queueCount,
    queue: getQueueInfo(data.queueCount)
  });
});

app.post("/api/orders", (req, res) => {
  const { items, customerName } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Bitte mindestens ein Produkt auswählen." });
  }

  const menuMap = new Map(MENU.map(item => [item.id, item]));
  const normalizedItems = [];
  let total = 0;

  for (const raw of items) {
    const product = menuMap.get(raw.id);
    const quantity = Math.max(1, Math.min(20, Number(raw.quantity) || 1));
    if (!product) return res.status(400).json({ error: "Ungültiges Produkt." });

    let variant = null;
    if (product.variants) {
      variant = product.variants.includes(raw.variant) ? raw.variant : product.variants[0];
    }

    normalizedItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      variant,
      quantity
    });

    total += product.price * quantity;
  }

  total = Number(total.toFixed(2));

  const data = loadData();
  const order = {
    number: data.nextOrderNumber++,
    customerName: String(customerName || "").trim().slice(0, 40),
    items: normalizedItems,
    total,
    status: "neu",
    createdAt: new Date().toISOString(),
    readyAt: null,
    completedAt: null
  };

  data.orders.push(order);
  saveData(data);

  res.status(201).json({
    orderNumber: order.number,
    order,
    total,
    message: `Bestellung #${order.number} wurde aufgenommen.`
  });
});

app.get("/api/orders/my/:number", (req, res) => {
  const data = loadData();
  const order = data.orders.find(o => o.number === Number(req.params.number));
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
  res.json(order);
});

app.post("/api/staff/login", (req, res) => {
  if (String(req.body.password || "") === STAFF_PASSWORD) {
    req.session.staff = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Falsches Passwort." });
});

app.post("/api/staff/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/staff/me", (req, res) => {
  res.json({ loggedIn: !!req.session.staff });
});

app.get("/api/staff/orders", requireStaff, (req, res) => {
  const data = loadData();
  res.json(data.orders.filter(o => o.status !== "abgeschlossen").slice().reverse());
});

app.patch("/api/staff/orders/:number", requireStaff, (req, res) => {
  const allowed = ["neu", "in_zubereitung", "abholbereit", "abgeschlossen"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Ungültiger Status." });
  }

  const data = loadData();
  const order = data.orders.find(o => o.number === Number(req.params.number));
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });

  order.status = status;
  if (status === "abholbereit") order.readyAt = new Date().toISOString();
  if (status === "abgeschlossen") order.completedAt = new Date().toISOString();
  saveData(data);

  res.json(order);
});

app.get("/api/arduino/queue", (req, res) => {
  const data = loadData();
  res.json({ count: data.queueCount, ...getQueueInfo(data.queueCount), timestamp: Date.now() });
});

app.post("/api/arduino/queue", (req, res) => {
  const count = Number(req.body.count);
  if (!Number.isInteger(count) || count < 0 || count > 999) {
    return res.status(400).json({ error: "Ungültige Personenzahl." });
  }

  const data = loadData();
  data.queueCount = count;
  saveData(data);

  res.json({ ok: true, count, ...getQueueInfo(count) });
});

app.get("/api/arduino/ready", (req, res) => {
  const data = loadData();
  const order = data.orders.find(o => o.status === "abholbereit");
  res.json(order || null);
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nMensa Organizer läuft auf http://localhost:${PORT}`);
  console.log(`Mitarbeiter-Passwort: ${STAFF_PASSWORD}`);
  console.log("Für andere Geräte im gleichen WLAN: http://<IP-DES-LAPTOPS>:" + PORT);
});
