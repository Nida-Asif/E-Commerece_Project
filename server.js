// Load .env file if it exists
try { require("dotenv").config(); } catch(e) { /* dotenv optional */ }

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");

const { generateProductContent, generateAnalyticsSummary, generateAnalyticsRecommendations } = require("./ai-content-generator.js");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/it_accessories_market";
const ADMIN_EMAIL = "admin@itmarket.local";
const ADMIN_PASSWORD = "Admin@12345";
const sessions = new Map();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value) {
  return String(value || "")
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTokenFromRequest(req) {
  const h = req.headers["x-auth-token"];
  const b = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  return h || b || "";
}

function createSession(user) {
  const token = crypto.randomUUID();
  sessions.set(token, { userId: user._id.toString(), name: user.name, email: user.email, role: user.role });
  return token;
}

function authRequired(req, res, next) {
  const token = getTokenFromRequest(req);
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ message: "Sign in required" });
  req.session = session; req.token = token; next();
}

function adminRequired(req, res, next) {
  const token = getTokenFromRequest(req);
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ message: "Admin sign in required" });
  if (session.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  req.session = session; req.token = token; next();
}

function normalizeProductPayload(payload) {
  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  return {
    name,
    price: Number(payload.price),
    image: String(payload.image || "").trim(),
    description,
    seoTitle: String(payload.seoTitle || name).trim(),
    metaDescription: String(payload.metaDescription || description).trim(),
    metaKeywords: String(payload.metaKeywords || "").trim(),
    slug: String(payload.slug || slugify(name)).trim() || slugify(name),
    category: String(payload.category || "IT Accessories").trim(),
    stockQuantity: Number(payload.stockQuantity) >= 0 ? Number(payload.stockQuantity) : 0,
    lowStockThreshold: Number(payload.lowStockThreshold) > 0 ? Number(payload.lowStockThreshold) : 5
  };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

// Price history entry
const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: String, default: "admin" },
  note: { type: String, default: "" }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  description: { type: String, default: "" },
  seoTitle: { type: String, default: "" },
  metaDescription: { type: String, default: "" },
  metaKeywords: { type: String, default: "" },
  slug: { type: String, default: "" },
  status: { type: String, default: "published", enum: ["published", "draft"] },
  category: { type: String, default: "IT Accessories" },
  // NEW: Inventory tracking
  stockQuantity: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  // NEW: Price history
  priceHistory: { type: [priceHistorySchema], default: [] }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  user: { type: String, required: true },
  userEmail: { type: String, required: true },
  products: { type: Array, default: [] },
  total: { type: Number, required: true },
  status: { type: String, default: "Processing" },
  trackingNumber: { type: String, default: "" },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

// ─── Seed Data ────────────────────────────────────────────────────────────────

async function ensureAdminUser() {
  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
  if (!existingAdmin) {
    await User.create({ name: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" });
    return;
  }
  if (existingAdmin.role !== "admin") {
    existingAdmin.role = "admin"; existingAdmin.password = ADMIN_PASSWORD;
    await existingAdmin.save();
  }
}

async function ensureSampleProducts() {
  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    // Migrate existing products: add missing fields
    await Product.updateMany({ stockQuantity: { $exists: false } }, { $set: { stockQuantity: 0 } });
    await Product.updateMany({ lowStockThreshold: { $exists: false } }, { $set: { lowStockThreshold: 5 } });
    await Product.updateMany({ category: { $exists: false } }, { $set: { category: "IT Accessories" } });
    await Product.updateMany({ priceHistory: { $exists: false } }, { $set: { priceHistory: [] } });
    return;
  }

  const now = new Date();
  const months = (n) => new Date(now.getTime() - n * 30 * 24 * 60 * 60 * 1000);

  await Product.insertMany([
    {
      name: "Wireless Headphones", price: 79.99, image: "/images/wireless-headphones.jpg",
      description: "Comfortable wireless headphones with clear sound and long battery life.",
      seoTitle: "Wireless Headphones", metaDescription: "Wireless headphones for everyday listening and gaming.",
      metaKeywords: "wireless headphones, bluetooth headphones, audio accessories",
      slug: "wireless-headphones", status: "published", category: "Headphones",
      stockQuantity: 45, lowStockThreshold: 10,
      priceHistory: [
        { price: 69.99, changedAt: months(6), note: "Launch price" },
        { price: 74.99, changedAt: months(4), note: "Q2 adjustment" },
        { price: 79.99, changedAt: months(1), note: "Current price" }
      ]
    },
    {
      name: "Mechanical Keyboard", price: 99.99, image: "/images/mechanical-keyboard.jpg",
      description: "Responsive mechanical keyboard built for fast typing and gaming.",
      seoTitle: "Mechanical Keyboard", metaDescription: "Mechanical keyboard with tactile switches.",
      metaKeywords: "mechanical keyboard, gaming keyboard, keyboard",
      slug: "mechanical-keyboard", status: "published", category: "Keyboards",
      stockQuantity: 3, lowStockThreshold: 5,
      priceHistory: [
        { price: 89.99, changedAt: months(5), note: "Launch price" },
        { price: 94.99, changedAt: months(3), note: "Minor increase" },
        { price: 99.99, changedAt: months(1), note: "Current price" }
      ]
    },
    {
      name: "Gaming Mousepad XL", price: 24.99, image: "/images/gaming-mousepad-xl.jpg",
      description: "Large mousepad with a smooth surface for precise mouse control.",
      seoTitle: "Gaming Mousepad XL", metaDescription: "Extra-large mousepad for gaming and desk setups.",
      metaKeywords: "gaming mousepad, mouse pad, desk accessory",
      slug: "gaming-mousepad-xl", status: "published", category: "Mousepads",
      stockQuantity: 120, lowStockThreshold: 15,
      priceHistory: [
        { price: 19.99, changedAt: months(8), note: "Launch price" },
        { price: 22.99, changedAt: months(4), note: "Q3 adjustment" },
        { price: 24.99, changedAt: months(2), note: "Current price" }
      ]
    },
    {
      name: "USB-C Hub 7-in-1", price: 49.99, image: "/images/usb-c-hub-7in1.jpg",
      description: "Compact USB-C hub with multiple ports for modern laptops.",
      seoTitle: "USB-C Hub 7-in-1", metaDescription: "Multi-port USB-C hub for charging, display, and accessories.",
      metaKeywords: "usb-c hub, laptop hub, type-c adapter",
      slug: "usb-c-hub-7in1", status: "published", category: "Hubs",
      stockQuantity: 2, lowStockThreshold: 5,
      priceHistory: [
        { price: 44.99, changedAt: months(7), note: "Launch price" },
        { price: 47.99, changedAt: months(3), note: "Supply cost increase" },
        { price: 49.99, changedAt: months(1), note: "Current price" }
      ]
    },
    {
      name: "1080p Webcam", price: 59.99, image: "/images/webcam-1080p.jpg",
      description: "Sharp 1080p webcam for video calls, streaming, and meetings.",
      seoTitle: "1080p Webcam", metaDescription: "Full HD webcam for calls and content creation.",
      metaKeywords: "webcam, 1080p camera, streaming webcam",
      slug: "webcam-1080p", status: "published", category: "Webcams",
      stockQuantity: 18, lowStockThreshold: 8,
      priceHistory: [
        { price: 54.99, changedAt: months(5), note: "Launch price" },
        { price: 59.99, changedAt: months(2), note: "Current price" }
      ]
    },
    {
      name: "Wireless Mouse", price: 29.99, image: "/images/smoke-test-mouse.jpg",
      description: "Reliable wireless mouse for everyday work and travel.",
      seoTitle: "Wireless Mouse", metaDescription: "Wireless mouse with a comfortable grip and precise tracking.",
      metaKeywords: "wireless mouse, computer mouse, office mouse",
      slug: "wireless-mouse", status: "published", category: "Mice",
      stockQuantity: 0, lowStockThreshold: 5,
      priceHistory: [
        { price: 24.99, changedAt: months(9), note: "Launch price" },
        { price: 27.99, changedAt: months(5), note: "Price revision" },
        { price: 29.99, changedAt: months(1), note: "Current price" }
      ]
    }
  ]);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    await ensureAdminUser();
    await ensureSampleProducts();
    console.log("MongoDB connected");
  })
  .catch((error) => { console.error("MongoDB connection error:", error.message); });

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/auth/me", authRequired, (req, res) => res.json({ user: req.session }));
app.post("/logout", authRequired, (req, res) => { sessions.delete(req.token); res.json({ message: "Logged out" }); });

app.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required" });
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already exists" });
    const user = new User({ name, email, password, role: "user" });
    await user.save();
    res.json({ message: "User Registered" });
  } catch { res.status(400).json({ message: "Registration failed" }); }
});

app.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: "Invalid Login" });
    const token = createSession(user);
    res.json({ message: "Login Success", token, user: { name: user.name, email: user.email, role: user.role, token } });
  } catch { res.status(400).json({ message: "Login failed" }); }
});

// ─── Product Routes ───────────────────────────────────────────────────────────

app.get("/products", async (req, res) => {
  try {
    const products = await Product.find({ $or: [{ status: "published" }, { status: { $exists: false } }] }).sort({ createdAt: -1 });
    res.json(products);
  } catch { res.status(500).json({ message: "Failed to load products" }); }
});

app.get("/admin/products", adminRequired, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch { res.status(500).json({ message: "Failed to load products" }); }
});

app.get("/admin/drafts", adminRequired, async (req, res) => {
  try {
    const drafts = await Product.find({ status: "draft" }).sort({ createdAt: -1 });
    res.json(drafts);
  } catch { res.status(500).json({ message: "Failed to load drafts" }); }
});

app.get("/trending-products", async (req, res) => {
  try {
    const topItems = await Order.aggregate([
      { $unwind: "$products" },
      { $group: { _id: "$products.id", score: { $sum: { $ifNull: ["$products.quantity", 1] } } } },
      { $sort: { score: -1 } }, { $limit: 10 }
    ]);
    const idOrder = topItems.map(i => String(i._id || "")).filter(id => mongoose.Types.ObjectId.isValid(id));
    if (!idOrder.length) {
      const fallback = await Product.find({ $or: [{ status: "published" }, { status: { $exists: false } }] }).sort({ createdAt: -1 }).limit(5);
      return res.json(fallback);
    }
    const products = await Product.find({ _id: { $in: idOrder } });
    const scoreMap = new Map(topItems.map(i => [String(i._id), Number(i.score) || 0]));
    const productMap = new Map(products.map(p => [String(p._id), p]));
    const sorted = idOrder.map(id => productMap.get(id)).filter(Boolean)
      .map(p => ({ ...p.toObject(), trendScore: scoreMap.get(String(p._id)) || 0 }));
    res.json(sorted);
  } catch { res.status(500).json({ message: "Failed to load trending products" }); }
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch { res.status(400).json({ message: "Invalid product id" }); }
});

// ── Add product (with stock + category + price history) ──
app.post("/addProduct", adminRequired, async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const status = req.body.status === "draft" ? "draft" : "published";
    const product = new Product({
      ...payload, status,
      priceHistory: [{ price: payload.price, changedAt: new Date(), note: "Initial price" }]
    });
    await product.save();
    res.json({ message: status === "draft" ? "Product Saved as Draft" : "Product Added", product });
  } catch { res.status(400).json({ message: "Failed to add product" }); }
});

// ── Update product (auto-track price change) ──
app.put("/updateProduct/:id", adminRequired, async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const status = req.body.status === "draft" ? "draft" : "published";
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Product not found" });

    const updateData = { ...payload, status };

    // If price changed, push to priceHistory
    if (existing.price !== payload.price) {
      const note = req.body.priceNote || `Price changed from $${existing.price} to $${payload.price}`;
      updateData.$push = {
        priceHistory: { price: payload.price, changedAt: new Date(), changedBy: req.session.name || "admin", note }
      };
      delete updateData.priceHistory; // don't overwrite array
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json({ message: "Product Updated", product: updatedProduct });
  } catch (e) { res.status(400).json({ message: "Failed to update product" }); }
});

app.put("/publishProduct/:id", adminRequired, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { status: "published" }, { new: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product Published", product });
  } catch { res.status(400).json({ message: "Failed to publish product" }); }
});

// ── NEW: Update stock quantity ──
app.put("/admin/products/:id/stock", adminRequired, async (req, res) => {
  try {
    const stockQuantity = Number(req.body.stockQuantity);
    const lowStockThreshold = Number(req.body.lowStockThreshold);
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0)
      return res.status(400).json({ message: "Invalid stock quantity" });

    const update = { stockQuantity };
    if (Number.isFinite(lowStockThreshold) && lowStockThreshold > 0) update.lowStockThreshold = lowStockThreshold;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Stock Updated", product });
  } catch { res.status(400).json({ message: "Failed to update stock" }); }
});

// ── NEW: Get price history for one product ──
app.get("/admin/products/:id/price-history", adminRequired, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id, "name price priceHistory category");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ name: product.name, currentPrice: product.price, priceHistory: product.priceHistory });
  } catch { res.status(400).json({ message: "Failed to load price history" }); }
});

app.delete("/deleteProduct/:id", adminRequired, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product Deleted" });
  } catch { res.status(400).json({ message: "Failed to delete product" }); }
});

// ─── Order Routes ─────────────────────────────────────────────────────────────

app.post("/order", authRequired, async (req, res) => {
  try {
    const products = Array.isArray(req.body.products) ? req.body.products : [];
    const total = Number(req.body.total);
    if (!products.length) return res.status(400).json({ message: "Cart is empty" });
    if (!Number.isFinite(total) || total <= 0) return res.status(400).json({ message: "Invalid order total" });

    const order = new Order({
      user: req.session.name, userEmail: req.session.email,
      products, total, status: "Processing",
      trackingNumber: `ITM-${Date.now()}`
    });
    await order.save();

    // Auto-deduct stock for each product ordered
    for (const item of products) {
      const id = item.id || item._id;
      const qty = Number(item.quantity || 1);
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        await Product.findByIdAndUpdate(id, { $inc: { stockQuantity: -qty } });
      }
    }

    res.json({ message: "Order Placed", orderId: order._id, trackingNumber: order.trackingNumber });
  } catch { res.status(400).json({ message: "Failed to place order" }); }
});

app.get("/orders", adminRequired, async (req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 })); }
  catch { res.status(500).json({ message: "Failed to load orders" }); }
});

app.get("/my-orders", authRequired, async (req, res) => {
  try { res.json(await Order.find({ userEmail: req.session.email }).sort({ createdAt: -1 })); }
  catch { res.status(500).json({ message: "Failed to load orders" }); }
});

app.put("/orders/:id/status", adminRequired, async (req, res) => {
  try {
    const status = String(req.body.status || "").trim();
    if (!status) return res.status(400).json({ message: "Status is required" });
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order Updated", order: updatedOrder });
  } catch { res.status(400).json({ message: "Failed to update order" }); }
});

// ─── AI Content Endpoints ─────────────────────────────────────────────────────

app.post("/ai/analytics-summary", adminRequired, async (req, res) => {
  try {
    const { summary, topProduct, peakMonth } = req.body;
    res.json({ text: generateAnalyticsSummary(summary, topProduct, peakMonth) });
  } catch { res.json({ text: "Analytics loaded successfully." }); }
});

app.post("/ai/analytics-recommendations", adminRequired, async (req, res) => {
  try {
    res.json(generateAnalyticsRecommendations(req.body.topProducts, req.body.highPerf, req.body.lowPerf));
  } catch { res.json([{ icon: "🚀", text: "Focus on promotion" }]); }
});

app.post("/ai/generate-product-content", adminRequired, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    if (!name && !description) return res.status(400).json({ message: "Name or description needed" });
    const result = generateProductContent(name, description);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch { res.status(500).json({ message: "Generation failed" }); }
});

// ─── AI Price Drop Suggestion ─────────────────────────────────────────────────
// Analyzes price history and sales to suggest whether to drop price
app.get("/ai/price-analysis", adminRequired, async (req, res) => {
  try {
    const allProducts = await Product.find().lean();
    const allOrders = await Order.find().lean();

    const productSalesMap = {};
    allOrders.forEach(order => {
      (order.products || []).forEach(item => {
        const id = String(item.id || item._id || "");
        if (!id) return;
        if (!productSalesMap[id]) productSalesMap[id] = { quantity: 0, revenue: 0 };
        productSalesMap[id].quantity += Number(item.quantity || 1);
        productSalesMap[id].revenue += Number(item.quantity || 1) * Number(item.price || 0);
      });
    });

    const analysis = allProducts.map(product => {
      const id = String(product._id);
      const sales = productSalesMap[id] || { quantity: 0, revenue: 0 };
      const history = product.priceHistory || [];

      // Price increase % over full history
      let priceIncrease = 0;
      let priceIncreaseAbs = 0;
      let firstPrice = null;
      if (history.length >= 2) {
        firstPrice = history[0].price;
        priceIncrease = ((product.price - firstPrice) / firstPrice) * 100;
        priceIncreaseAbs = product.price - firstPrice;
      }

      // Suggestion logic
      let suggestion = "hold";
      let reason = "Price and sales are stable.";
      let urgency = "low";

      if (priceIncrease > 25 && sales.quantity < 5) {
        suggestion = "drop";
        reason = `Price rose ${priceIncrease.toFixed(0)}% since launch but sales are very low (${sales.quantity} units). A price drop may stimulate demand.`;
        urgency = "high";
      } else if (priceIncrease > 15 && sales.quantity < 10) {
        suggestion = "consider-drop";
        reason = `Price increased ${priceIncrease.toFixed(0)}% with moderate sales. Consider a small discount to boost volume.`;
        urgency = "medium";
      } else if (product.stockQuantity === 0 && sales.quantity > 0) {
        suggestion = "restock";
        reason = "Product is out of stock but has active sales history. Restock immediately.";
        urgency = "high";
      } else if (product.stockQuantity <= product.lowStockThreshold && product.stockQuantity > 0) {
        suggestion = "restock-soon";
        reason = `Only ${product.stockQuantity} units left (threshold: ${product.lowStockThreshold}). Reorder soon.`;
        urgency = "medium";
      } else if (sales.quantity > 20) {
        suggestion = "increase";
        reason = "Strong sales volume. You may be able to raise the price slightly.";
        urgency = "low";
      }

      return {
        id, name: product.name, category: product.category,
        currentPrice: product.price, firstPrice,
        priceIncrease: Math.round(priceIncrease * 10) / 10,
        priceIncreaseAbs: Math.round(priceIncreaseAbs * 100) / 100,
        totalSales: sales.quantity,
        revenue: Math.round(sales.revenue * 100) / 100,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        priceHistoryCount: history.length,
        suggestion, reason, urgency
      };
    });

    res.json(analysis);
  } catch (e) { res.status(500).json({ message: "Price analysis failed" }); }
});

// ─── Main Analytics Endpoint (enhanced) ──────────────────────────────────────
app.get("/admin/analytics", adminRequired, async (req, res) => {
  try {
    const [allOrders, allProducts, allUsers] = await Promise.all([Order.find().lean(), Product.find().lean(), User.find().lean()]);

    const totalRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Monthly revenue
    const monthlyMap = {};
    allOrders.forEach(order => {
      const d = new Date(order.date || order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + (order.total || 0);
    });
    const monthlyRevenue = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

    // Product sales aggregation
    const productSalesMap = {};
    allOrders.forEach(order => {
      (order.products || []).forEach(item => {
        const id = String(item.id || item._id || "");
        if (!id) return;
        if (!productSalesMap[id]) productSalesMap[id] = { id, name: item.name || "Unknown", quantity: 0, revenue: 0 };
        const qty = Number(item.quantity || 1);
        productSalesMap[id].quantity += qty;
        productSalesMap[id].revenue += qty * Number(item.price || 0);
      });
    });

    const productSales = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);
    const topProducts = productSales.slice(0, 5).map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));

    // Seasonal trends
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const seasonalMap = {};
    allOrders.forEach(order => {
      const m = monthNames[new Date(order.date || order.createdAt).getMonth()];
      seasonalMap[m] = (seasonalMap[m] || 0) + (order.total || 0);
    });
    const seasonalTrends = monthNames.map(m => ({ month: m, revenue: Math.round((seasonalMap[m] || 0) * 100) / 100 }));

    // Performance scores
    const maxQty = Math.max(...productSales.map(p => p.quantity), 1);
    const performanceScores = allProducts.map(product => {
      const sales = productSalesMap[String(product._id)];
      const qty = sales ? sales.quantity : 0;
      const score = Math.round((qty / maxQty) * 100);
      return {
        id: String(product._id), name: product.name, price: product.price,
        category: product.category || "IT Accessories",
        score, status: score >= 70 ? "Excellent" : score >= 40 ? "Average" : "Needs Improvement",
        quantity: qty, revenue: sales ? Math.round(sales.revenue * 100) / 100 : 0,
        stockQuantity: product.stockQuantity || 0,
        lowStockThreshold: product.lowStockThreshold || 5
      };
    }).sort((a, b) => b.score - a.score);

    const publishedCount = allProducts.filter(p => p.status !== "draft").length;
    const draftCount = allProducts.filter(p => p.status === "draft").length;

    // ── NEW: Real inventory alerts ──
    const inventoryAlerts = allProducts.map(p => {
      const stock = p.stockQuantity || 0;
      const threshold = p.lowStockThreshold || 5;
      let alertType = null;
      if (stock === 0) alertType = "out_of_stock";
      else if (stock <= threshold) alertType = "low_stock";
      return { id: String(p._id), name: p.name, category: p.category, stockQuantity: stock, lowStockThreshold: threshold, alertType };
    }).filter(p => p.alertType !== null);

    // ── NEW: Category-wise sales aggregation ──
    const categoryMap = {};
    allOrders.forEach(order => {
      (order.products || []).forEach(item => {
        const productId = String(item.id || item._id || "");
        const product = allProducts.find(p => String(p._id) === productId);
        const cat = product?.category || item.category || "Other";
        if (!categoryMap[cat]) categoryMap[cat] = { category: cat, quantity: 0, revenue: 0, orderCount: 0 };
        const qty = Number(item.quantity || 1);
        categoryMap[cat].quantity += qty;
        categoryMap[cat].revenue += qty * Number(item.price || 0);
        categoryMap[cat].orderCount++;
      });
    });
    const categorySales = Object.values(categoryMap)
      .sort((a, b) => b.quantity - a.quantity)
      .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }));

    // ── NEW: Category forecast (next 30 days estimate based on trend) ──
    // Group last 60 days vs previous 60 days per category
    const now = new Date();
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const catLast30 = {}, catPrev30 = {};
    allOrders.forEach(order => {
      const orderDate = new Date(order.date || order.createdAt);
      (order.products || []).forEach(item => {
        const productId = String(item.id || item._id || "");
        const product = allProducts.find(p => String(p._id) === productId);
        const cat = product?.category || item.category || "Other";
        const qty = Number(item.quantity || 1);
        if (orderDate >= d30) { catLast30[cat] = (catLast30[cat] || 0) + qty; }
        else if (orderDate >= d60) { catPrev30[cat] = (catPrev30[cat] || 0) + qty; }
      });
    });

    const allCategories = [...new Set([...Object.keys(catLast30), ...Object.keys(catPrev30)])];
    const categoryForecast = allCategories.map(cat => {
      const last = catLast30[cat] || 0;
      const prev = catPrev30[cat] || 0;
      let trend = 0;
      if (prev > 0) trend = ((last - prev) / prev) * 100;
      else if (last > 0) trend = 100;

      // Forecast next 30 days = last30 * (1 + trend/100), clamped
      const forecast = Math.max(0, Math.round(last * (1 + Math.min(trend, 200) / 100)));
      return {
        category: cat,
        last30Sales: last,
        prev30Sales: prev,
        trendPercent: Math.round(trend * 10) / 10,
        forecastNext30: forecast,
        direction: trend > 10 ? "up" : trend < -10 ? "down" : "stable"
      };
    }).sort((a, b) => b.forecastNext30 - a.forecastNext30);

    // ── NEW: Price history summary (top 5 products with most price changes) ──
    const priceChangeSummary = allProducts
      .filter(p => (p.priceHistory || []).length >= 2)
      .map(p => {
        const h = p.priceHistory;
        const first = h[0].price;
        const last = h[h.length - 1].price;
        const changePercent = ((last - first) / first) * 100;
        return {
          id: String(p._id), name: p.name, category: p.category,
          startPrice: first, currentPrice: last,
          changePercent: Math.round(changePercent * 10) / 10,
          changesCount: h.length,
          history: h
        };
      }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 6);

    res.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders, avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalProducts: allProducts.length, publishedCount, draftCount,
        totalUsers: allUsers.length,
        totalAdmins: allUsers.filter(u => u.role === "admin").length,
        outOfStockCount: inventoryAlerts.filter(a => a.alertType === "out_of_stock").length,
        lowStockCount: inventoryAlerts.filter(a => a.alertType === "low_stock").length
      },
      topProducts, monthlyRevenue, seasonalTrends, performanceScores,
      // New data
      inventoryAlerts,
      categorySales,
      categoryForecast,
      priceChangeSummary,
      // Backwards compat
      lowStockAlerts: inventoryAlerts.slice(0, 5).map(p => ({
        name: p.name, quantity: p.stockQuantity,
        warning: p.alertType === "out_of_stock" ? "Out of stock!" : "Low stock"
      }))
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});



// --- Forgot Password Endpoint -----------------------------------------------
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email not found" });

    // Generate 6-digit token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    // Log to console for demo (in production, send via email)
    console.log(`?? Password reset token for ${email}: ${token} (expires in 15 min)`);

    res.json({ 
      message: "Check console for reset token (demo mode). In production, token sent to email.",
      email 
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});

// --- Reset Password Endpoint -----------------------------------------------
app.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "Email, token, and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Validate token and expiry
    if (user.resetPasswordToken !== token) {
      return res.status(400).json({ message: "Invalid token" });
    }
    if (new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ message: "Token expired. Request a new one." });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });





