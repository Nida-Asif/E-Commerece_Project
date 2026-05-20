// const API_BASE = "http://localhost:3000";
const API_BASE = window.location.origin;
const COUPON_KEY = "activeCoupon";
const COUPON_MAP = {
  SAVE10: 0.1,
  WELCOME15: 0.15,
  FREESHIP5: 0.05
};
const ORDER_TIMELINE = ["Processing", "Packed", "Shipped", "Delivered"];

function getActiveCoupon() {
  return localStorage.getItem(COUPON_KEY) || "";
}

function setActiveCoupon(code) {
  if (!code) {
    localStorage.removeItem(COUPON_KEY);
    return;
  }
  localStorage.setItem(COUPON_KEY, code.toUpperCase());
}

function getCartPricing() {
  const cart = getCart();
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity || 1),
    0
  );
  const coupon = getActiveCoupon();
  const rate = COUPON_MAP[coupon] || 0;
  const discount = subtotal * rate;
  const total = Math.max(subtotal - discount, 0);

  return {
    subtotal,
    coupon,
    discount,
    total
  };
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (error) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem("currentUser", JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem("currentUser");
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const currentUser = getCurrentUser();
  if (currentUser?.token) {
    headers["x-auth-token"] = currentUser.token;
  }
  return headers;
}

function storageKey(prefix) {
  const currentUser = getCurrentUser();
  return currentUser?.email ? `${prefix}:${currentUser.email}` : `${prefix}:guest`;
}

function getScopedList(prefix) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(prefix)) || "[]");
  } catch (error) {
    return [];
  }
}

function setScopedList(prefix, value) {
  localStorage.setItem(storageKey(prefix), JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonArg(value) {
  return JSON.stringify(value ?? "");
}

function resolveImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${API_BASE}${raw}`;
  }

  return `${API_BASE}/${raw.replace(/^\/+/, "")}`;
}

function normalizeImagePath(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  if (raw.startsWith("images/")) {
    return `/${raw}`;
  }

  return `/images/${raw}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function upsertMeta(attr, key, content) {
  let element = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function updateProductSeo(product) {
  const seoTitle = product.seoTitle || product.name;
  const metaDescription = product.metaDescription || product.description || `${product.name} available now at IT Accessories Marketplace.`;
  const metaKeywords = product.metaKeywords || `${product.name}, IT accessories, marketplace`;

  document.title = `${seoTitle} - IT Accessories Marketplace`;
  upsertMeta("name", "description", metaDescription);
  upsertMeta("name", "keywords", metaKeywords);
  upsertMeta("property", "og:title", seoTitle);
  upsertMeta("property", "og:description", metaDescription);
  upsertMeta("property", "og:image", resolveImageUrl(product.image));
}

function getCart() {
  return getScopedList("cart");
}

function setCart(cart) {
  setScopedList("cart", cart);
  localStorage.setItem(storageKey("cartUpdatedAt"), String(Date.now()));
}

function getWishlist() {
  return getScopedList("wishlist");
}

function setWishlist(wishlist) {
  setScopedList("wishlist", wishlist);
}

function viewProduct(id) {
  trackProductInteraction(id, "view");
  const viewed = getScopedList("viewedProducts");
  viewed.unshift(String(id));
  setScopedList("viewedProducts", [...new Set(viewed)].slice(0, 50));
  window.location = `product.html?id=${id}`;
}

function addCart(id, name, price, image) {
  trackProductInteraction(id, "click");
  const cart = getCart();
  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + 1;
  } else {
    cart.push({ id, name, price: Number(price), image: image || "", quantity: 1 });
  }

  setCart(cart);
  alert("Added to cart");
  renderCart();
}

function removeCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  setCart(cart);
  renderCart();
}

function addWishlist(id, name, price, image) {
  trackProductInteraction(id, "click");
  const wishlist = getWishlist();
  if (wishlist.some((item) => item.id === id)) {
    alert("Already in wishlist");
    return;
  }

  wishlist.push({ id, name, price: Number(price), image: image || "" });
  setWishlist(wishlist);
  alert("Added to wishlist");
  renderWishlist();
}

function removeWishlist(index) {
  const wishlist = getWishlist();
  wishlist.splice(index, 1);
  setWishlist(wishlist);
  renderWishlist();
}

function renderProductCards(products) {
  return products
    .map((product) => `
      <div class="card product-card">
        <img src="${resolveImageUrl(product.image)}" alt="${escapeHtml(product.name)}">
        <h3>${escapeHtml(product.name)}</h3>
        <h4>$${Number(product.price).toFixed(2)}</h4>
        <p>${escapeHtml(product.description || "")}</p>
        <button onclick='viewProduct(${jsonArg(product._id)})'>View Details</button>
        <button onclick='addCart(${jsonArg(product._id)}, ${jsonArg(product.name)}, ${Number(product.price)}, ${jsonArg(product.image || "")})'>Add to Cart</button>
        <button onclick='addWishlist(${jsonArg(product._id)}, ${jsonArg(product.name)}, ${Number(product.price)}, ${jsonArg(product.image || "")})'>Wishlist</button>
      </div>
    `)
    .join("");
}

async function loadProducts() {
  const grid = document.querySelector(".product-grid");
  if (!grid) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products`);
    const products = await response.json();

    if (!response.ok) {
      throw new Error(products.message || "Failed to load products");
    }

    if (!products.length) {
      grid.innerHTML = "<p>No products found. Add from Admin page.</p>";
      return;
    }

    grid.innerHTML = renderProductCards(products);
  } catch (error) {
    grid.innerHTML = "<p>Could not load products. Start backend server.</p>";
  }
}

async function initProductDetails() {
  const detailBox = document.getElementById("product-detail");
  const addButton = document.getElementById("add-detail-cart");
  const wishlistButton = document.getElementById("add-detail-wishlist");

  if (!detailBox || !addButton) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    detailBox.innerHTML = "<p>Invalid product ID.</p>";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/product/${id}`);
    const product = await response.json();

    if (!response.ok) {
      detailBox.innerHTML = `<p>${escapeHtml(product.message || "Product not found")}</p>`;
      return;
    }

    updateProductSeo(product);

    detailBox.innerHTML = `
      <div class="detail-layout">
        <img src="${resolveImageUrl(product.image)}" alt="${escapeHtml(product.name)}" class="detail-image">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <h4>$${Number(product.price).toFixed(2)}</h4>
          <p>${escapeHtml(product.description || "No description available.")}</p>
          <div class="meta-panel">
            <p><strong>SEO Title:</strong> ${escapeHtml(product.seoTitle || product.name)}</p>
            <p><strong>Meta Description:</strong> ${escapeHtml(product.metaDescription || product.description || "")}</p>
            <p><strong>Meta Keywords:</strong> ${escapeHtml(product.metaKeywords || "")}</p>
            <p><strong>Slug:</strong> ${escapeHtml(product.slug || slugify(product.name))}</p>
          </div>
        </div>
      </div>
    `;

    addButton.onclick = () => addCart(product._id, product.name, product.price, product.image);
    if (wishlistButton) {
      wishlistButton.onclick = () => addWishlist(product._id, product.name, product.price, product.image);
    }
  } catch (error) {
    detailBox.innerHTML = "<p>Could not load product details.</p>";
  }
}

function renderCart() {
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");

  if (!cartItems || !cartTotal) {
    return;
  }

  const cart = getCart();

  if (!cart.length) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    cartTotal.textContent = "Total: $0.00";
    return;
  }

  cartItems.innerHTML = cart
    .map((item, index) => {
      const quantity = Number(item.quantity || 1);
      const price = Number(item.price) * quantity;
      const imageUrl = resolveImageUrl(item.image || "");
      const imageMarkup = imageUrl
        ? `<img class="saved-item-thumb" src="${imageUrl}" alt="${escapeHtml(item.name)}">`
        : `<div class="saved-item-thumb saved-item-thumb--empty">No image</div>`;

      return `
        <div class="list-row saved-item-row">
          <div class="saved-item-media">
            ${imageMarkup}
            <div class="saved-item-body">
              <strong>${escapeHtml(item.name)}</strong>
              <div class="muted-text">Qty: ${quantity}</div>
              <div class="muted-text">$${price.toFixed(2)}</div>
            </div>
          </div>
          <button class="danger-btn" onclick="removeCart(${index})">Remove</button>
        </div>
      `;
    })
    .join("");

  const pricing = getCartPricing();
  const couponLine = pricing.coupon
    ? ` | Coupon (${pricing.coupon}): -$${pricing.discount.toFixed(2)}`
    : "";
  cartTotal.textContent = `Subtotal: $${pricing.subtotal.toFixed(2)}${couponLine} | Total: $${pricing.total.toFixed(2)}`;
}
async function placeOrder() {
  const currentUser = getCurrentUser();
  if (!currentUser?.token) {
    alert("Please sign in to checkout");
    window.location = "login.html";
    return;
  }

  const cart = getCart();
  if (!cart.length) {
    alert("Cart is empty");
    return;
  }

  const pricing = getCartPricing();
  const total = pricing.total;

  try {
    const response = await fetch(`${API_BASE}/order`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        products: cart,
        total,
        coupon: pricing.coupon || null
      })
    });

    const data = await response.json();
    alert(data.message || "Order placed");

    if (response.ok) {
      setCart([]);
      setActiveCoupon("");
      renderCart();
      window.location = "orders.html";
    }
  } catch (error) {
    alert("Failed to place order");
  }
}

function initCartPage() {
  const placeOrderButton = document.getElementById("place-order");
  if (!placeOrderButton) {
    return;
  }

  placeOrderButton.textContent = "Checkout Sandbox";
  renderCart();
  placeOrderButton.addEventListener("click", placeOrder);
}

function initRegister() {
  const form = document.getElementById("register-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById("register-name").value.trim(),
      email: document.getElementById("register-email").value.trim(),
      password: document.getElementById("register-password").value
    };

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      alert(data.message || "Registration complete");

      if (response.ok) {
        window.location = "login.html";
      }
    } catch (error) {
      alert("Registration failed");
    }
  });
}

function initLogin() {
  const form = document.getElementById("login-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value
    };

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      alert(data.message || "Login complete");

      if (response.ok && data.user) {
        setCurrentUser(data.user);
        window.location = data.user.role === "admin" ? "admin.html" : "products.html";
      }
    } catch (error) {
      alert("Login failed");
    }
  });
}

function renderAdminProductList(products) {
  // Renders published products
  const container = document.getElementById("admin-products");
  if (!container) return;

  const published = products.filter(p => !p.status || p.status === "published");
  if (!published.length) {
    container.innerHTML = "<p>No published products yet.</p>";
    return;
  }

  container.innerHTML = published.map((product) => `
    <div class="list-row admin-item" style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div class="admin-item-body" style="flex:1 1 auto;min-width:0;">
        <div class="admin-product-head">
          <strong>${escapeHtml(product.name)}</strong>
          <span class="pill-published">Published</span>
        </div>
        <div class="muted-text">$${Number(product.price).toFixed(2)} | ${escapeHtml(product.slug || slugify(product.name))}</div>
        <div class="muted-text">${escapeHtml(product.seoTitle || product.name)}</div>
      </div>
      <div class="admin-item-actions" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-end;gap:10px;white-space:nowrap;margin-left:auto;">
        <button class="secondary-btn" onclick='editAdminProduct(${jsonArg(product._id)})'>Edit</button>
        <button class="danger-btn" onclick='deleteProduct(${jsonArg(product._id)})'>Delete</button>
      </div>
    </div>
  `).join("");
}

function renderDraftList(products) {
  const container = document.getElementById("admin-drafts");
  if (!container) return;

  const drafts = products.filter(p => p.status === "draft");
  if (!drafts.length) {
    container.innerHTML = "<p class=\"muted-text\">No draft products.</p>";
    return;
  }

  container.innerHTML = drafts.map((product) => `
    <div class="list-row admin-item" style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div class="admin-item-body" style="flex:1 1 auto;min-width:0;">
        <div class="admin-product-head">
          <strong>${escapeHtml(product.name)}</strong>
          <span class="pill-draft">Draft</span>
        </div>
        <div class="muted-text">$${Number(product.price).toFixed(2)} | ${escapeHtml(product.slug || slugify(product.name))}</div>
        <div class="muted-text">${escapeHtml(product.seoTitle || product.name)}</div>
      </div>
      <div class="admin-item-actions" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-end;gap:10px;white-space:nowrap;margin-left:auto;">
        <button class="publish-inline-btn" onclick='publishProduct(${jsonArg(product._id)})'>Publish</button>
        <button class="secondary-btn" onclick='editAdminProduct(${jsonArg(product._id)})'>Edit</button>
        <button class="danger-btn" onclick='deleteProduct(${jsonArg(product._id)})'>Delete</button>
      </div>
    </div>
  `).join("");
}

async function loadAdminProducts() {
  const container = document.getElementById("admin-products");
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/admin/products`, { headers: authHeaders() });
    const products = await response.json();
    if (!response.ok) throw new Error(products.message || "Unable to load products");
    renderAdminProductList(products);
    renderDraftList(products);
  } catch (error) {
    container.innerHTML = "<p>Unable to load products.</p>";
  }
}

async function publishProduct(id) {
  try {
    const response = await fetch(`${API_BASE}/publishProduct/${id}`, {
      method: "PUT",
      headers: authHeaders()
    });
    const data = await response.json();
    alert(data.message || "Product Published");
    if (response.ok) loadAdminProducts();
  } catch (error) {
    alert("Failed to publish product");
  }
}

function clearAdminForm() {
  const form = document.getElementById("admin-add-form");
  if (!form) {
    return;
  }

  form.reset();
  const idField = document.getElementById("admin-id");
  const submitButton = document.getElementById("admin-submit");
  const title = document.getElementById("admin-form-title");
  if (idField) {
    idField.value = "";
  }
  if (submitButton) {
    submitButton.textContent = "Add Product";
  }
  if (title) {
    title.textContent = "Add Product";
  }
}

function fillAdminForm(product) {
  const idField = document.getElementById("admin-id");
  const nameField = document.getElementById("admin-name");
  const priceField = document.getElementById("admin-price");
  const imageField = document.getElementById("admin-image");
  const descriptionField = document.getElementById("admin-description");
  const seoTitleField = document.getElementById("admin-seo-title");
  const metaDescriptionField = document.getElementById("admin-meta-description");
  const metaKeywordsField = document.getElementById("admin-meta-keywords");
  const submitButton = document.getElementById("admin-submit");
  const title = document.getElementById("admin-form-title");

  if (idField) idField.value = product._id;
  if (nameField) nameField.value = product.name || "";
  if (priceField) priceField.value = product.price || "";
  if (imageField) imageField.value = product.image || "";
  if (descriptionField) descriptionField.value = product.description || "";
  if (seoTitleField) seoTitleField.value = product.seoTitle || product.name || "";
  if (metaDescriptionField) metaDescriptionField.value = product.metaDescription || product.description || "";
  if (metaKeywordsField) metaKeywordsField.value = product.metaKeywords || "";
  const catField = document.getElementById("admin-category");
  const stockField = document.getElementById("admin-stock");
  const lowStockField = document.getElementById("admin-low-stock");
  if (catField) catField.value = product.category || "IT Accessories";
  if (stockField) stockField.value = product.stockQuantity || 0;
  if (lowStockField) lowStockField.value = product.lowStockThreshold || 5;
  if (submitButton) submitButton.textContent = "Update Product";
  if (title) title.textContent = `Edit Product - ${product.name}`;
}

async function editAdminProduct(id) {
  try {
    const response = await fetch(`${API_BASE}/product/${id}`, { headers: authHeaders() });
    const product = await response.json();

    if (!response.ok) {
      alert(product.message || "Unable to load product");
      return;
    }

    fillAdminForm(product);
    window.location.hash = "admin-add-form";
  } catch (error) {
    alert("Failed to load product");
  }
}

async function updateProduct(id) {
  return editAdminProduct(id);
}

async function deleteProduct(id) {
  const confirmed = confirm("Delete this product?");
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/deleteProduct/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    const data = await response.json();
    alert(data.message || "Product Deleted");

    if (response.ok) {
      clearAdminForm();
      loadAdminProducts();
      loadAdminOrders();
      loadProducts();
    }
  } catch (error) {
    alert("Failed to delete product");
  }
}

function ensureAdminAccess() {
  const currentUser = getCurrentUser();
  const main = document.querySelector("main.page-wrap");
  if (!main) {
    return false;
  }

  if (!currentUser?.token) {
    main.innerHTML = `
      <section class="admin-gate">
        <div class="admin-gate-card">
          <div class="auth-badge">Admin Access Required</div>
          <h1>Sign in to manage the dashboard</h1>
          <p>Use the admin account to edit products, manage SEO, and update orders from this control center.</p>
          <div class="admin-gate-actions">
            <a class="primary-btn" href="login.html">Go to Login</a>
            <a class="secondary-btn" href="index.html">Back to Home</a>
          </div>
        </div>
      </section>
    `;
    return false;
  }

  if (currentUser.role !== "admin") {
    main.innerHTML = `
      <section class="admin-gate">
        <div class="admin-gate-card">
          <div class="auth-badge">Admin Access Required</div>
          <h1>Admin privileges needed</h1>
          <p>You are signed in, but this account does not have admin access. Please log in with the admin account to continue.</p>
          <div class="admin-gate-actions">
            <a class="primary-btn" href="login.html">Switch Account</a>
            <a class="secondary-btn" href="products.html">Browse Products</a>
          </div>
        </div>
      </section>
    `;
    return false;
  }

  return true;
}

// ── AI Content Generator ──────────────────────────────────────────────────────
async function generateAIContent() {
  const nameEl = document.getElementById("admin-name");
  const descEl = document.getElementById("admin-description");
  const seoTitleEl = document.getElementById("admin-seo-title");
  const metaDescEl = document.getElementById("admin-meta-description");
  const metaKwEl = document.getElementById("admin-meta-keywords");
  const btn = document.getElementById("ai-generate-btn");
  const label = document.getElementById("ai-btn-label");

  const name = nameEl?.value?.trim() || "";
  const description = descEl?.value?.trim() || "";

  if (!name && !description) {
    alert("Please enter at least a Product Name or Description before generating AI content.");
    return;
  }

  // Loading state
  btn.disabled = true;
  label.textContent = "Generating…";
  btn.innerHTML = `<span class="btn-spinner"></span><span id="ai-btn-label">Generating…</span>`;

  const prompt = `You are an SEO expert for an IT accessories e-commerce store. Based on the product below, generate SEO-optimized content and return ONLY a JSON object with no markdown or backticks.

Product Name: ${name}
Description: ${description}

Return exactly this JSON structure:
{
  "seoTitle": "SEO-optimized title (max 60 chars)",
  "metaDescription": "Compelling meta description (max 155 chars)",
  "metaKeywords": "keyword1, keyword2, keyword3, keyword4, keyword5 (comma separated, relevant to product)"
}`;

  try {
    // Server pe call karo — API key backend mein safe rahti hai
    const response = await fetch(`${API_BASE}/ai/generate-product-content`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name, description })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "AI failed");

    if (seoTitleEl && result.seoTitle) seoTitleEl.value = result.seoTitle;
    if (metaDescEl && result.metaDescription) metaDescEl.value = result.metaDescription;
    if (metaKwEl && result.metaKeywords) metaKwEl.value = result.metaKeywords;

    btn.innerHTML = `<span class="btn-icon">✅</span><span id="ai-btn-label">Content Generated!</span>`;
    setTimeout(() => {
      btn.innerHTML = `<span class="btn-icon">✨</span><span id="ai-btn-label">Generate AI Content</span>`;
      btn.disabled = false;
    }, 2000);

  } catch (err) {
    alert("AI generation failed. Please fill SEO fields manually.");
    btn.innerHTML = `<span class="btn-icon">✨</span><span id="ai-btn-label">Generate AI Content</span>`;
    btn.disabled = false;
  }
}

// ── Save as Draft ─────────────────────────────────────────────────────────────
async function saveProductAsDraft() {
  const productId = document.getElementById("admin-id")?.value || "";
  const name = document.getElementById("admin-name")?.value?.trim() || "";
  const price = Number(document.getElementById("admin-price")?.value || 0);
  const image = normalizeImagePath(document.getElementById("admin-image")?.value || "");

  if (!name) { alert("Product Name is required to save as draft."); return; }

  const payload = {
    name,
    price: price || 1,
    image: image || "images/placeholder.jpg",
    description: document.getElementById("admin-description")?.value?.trim() || "",
    seoTitle: document.getElementById("admin-seo-title")?.value?.trim() || name,
    metaDescription: document.getElementById("admin-meta-description")?.value?.trim() || "",
    metaKeywords: document.getElementById("admin-meta-keywords")?.value?.trim() || "",
    slug: slugify(document.getElementById("admin-seo-title")?.value?.trim() || name),
    category: document.getElementById("admin-category")?.value || "IT Accessories",
    stockQuantity: Number(document.getElementById("admin-stock")?.value || 0),
    lowStockThreshold: Number(document.getElementById("admin-low-stock")?.value || 5),
    status: "draft"
  };

  try {
    const url = productId ? `${API_BASE}/updateProduct/${productId}` : `${API_BASE}/addProduct`;
    const method = productId ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    const data = await response.json();
    alert(data.message || "Saved as Draft");
    if (response.ok) { clearAdminForm(); loadAdminProducts(); }
  } catch (err) {
    alert("Failed to save draft");
  }
}

// ── initAdmin (new version) ───────────────────────────────────────────────────
async function initAdmin() {
  const form = document.getElementById("admin-add-form");
  if (!form) return;

  if (!ensureAdminAccess()) return;

  // Cancel edit
  const cancelButton = document.getElementById("admin-cancel-edit");
  if (cancelButton) cancelButton.addEventListener("click", () => clearAdminForm());

  // AI Generate button
  const aiBtn = document.getElementById("ai-generate-btn");
  if (aiBtn) aiBtn.addEventListener("click", generateAIContent);

  // Save as Draft button
  const draftBtn = document.getElementById("admin-save-draft-btn");
  if (draftBtn) draftBtn.addEventListener("click", saveProductAsDraft);

  // Publish (submit) form
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const productId = document.getElementById("admin-id")?.value || "";
    const payload = {
      name: document.getElementById("admin-name").value.trim(),
      price: Number(document.getElementById("admin-price").value),
      image: normalizeImagePath(document.getElementById("admin-image").value),
      description: document.getElementById("admin-description").value.trim(),
      seoTitle: document.getElementById("admin-seo-title")?.value.trim() || "",
      metaDescription: document.getElementById("admin-meta-description")?.value.trim() || "",
      metaKeywords: document.getElementById("admin-meta-keywords")?.value.trim() || "",
      slug: slugify(document.getElementById("admin-seo-title")?.value.trim() || document.getElementById("admin-name").value.trim()),
      category: document.getElementById("admin-category")?.value || "IT Accessories",
      stockQuantity: Number(document.getElementById("admin-stock")?.value || 0),
      lowStockThreshold: Number(document.getElementById("admin-low-stock")?.value || 5),
      status: "published"
    };

    try {
      const response = await fetch(
        productId ? `${API_BASE}/updateProduct/${productId}` : `${API_BASE}/addProduct`,
        { method: productId ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(payload) }
      );
      const data = await response.json();
      alert(data.message || (productId ? "Product Updated" : "Product Added"));
      if (response.ok) { form.reset(); clearAdminForm(); loadAdminProducts(); loadProducts(); }
    } catch (error) {
      alert("Failed to save product");
    }
  });

  await loadAdminProducts();
  await loadAdminOrders();
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await response.json();
    alert(data.message || "Order updated");

    if (response.ok) {
      loadAdminOrders();
      initOrders();
    }
  } catch (error) {
    alert("Failed to update order status");
  }
}

function renderOrders(container, orders, isAdmin) {
  if (!orders.length) {
    container.innerHTML = isAdmin ? "<p>No orders yet.</p>" : "<p>No orders found for your account.</p>";
    return;
  }

  container.innerHTML = orders
    .map(
      (order) => `
        <div class="detail-card order-card">
          <div class="list-row order-row" style="display:flex;flex-direction:column;gap:14px;">
            <div class="order-row-main" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:16px;min-width:0;">
              <div>
                <strong>${escapeHtml(order.user)}</strong>
                <div class="muted-text">${escapeHtml(order.userEmail)}</div>
                <div class="muted-text">Tracking: ${escapeHtml(order.trackingNumber || "Pending")}</div>
              </div>
              <div class="order-row-right" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-end;gap:12px;margin-left:auto;white-space:nowrap;">
                <div class="order-status-block">
                  <div class="muted-text order-status-line">${escapeHtml(order.status || "Processing")}</div>
                  <strong>$${Number(order.total).toFixed(2)}</strong>
                </div>
                ${isAdmin ? `
                  <div class="order-actions order-actions-inline">
                    <select id="status-${order._id}">
                      ${["Processing", "Packed", "Shipped", "Delivered", "Cancelled"]
                        .map((status) => `<option value="${status}" ${status === (order.status || "Processing") ? "selected" : ""}>${status}</option>`)
                        .join("")}
                    </select>
                    <button class="secondary-btn" onclick='updateOrderStatus(${jsonArg(order._id)}, document.getElementById(${jsonArg(`status-${order._id}`)}).value)'>Update Status</button>
                  </div>
                ` : ""}
              </div>
            </div>
            <div class="order-row-extra" style="display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid #edf2f8;">
              <div class="order-items">
                ${Array.isArray(order.products)
                  ? order.products
                      .map((item) => `<div class="muted-text">${escapeHtml(item.name)} x ${Number(item.quantity || 1)}</div>`)
                      .join("")
                  : ""}
              </div>
              <div class="muted-text order-date">${new Date(order.date).toLocaleString()}</div>
            </div>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadAdminOrders() {
  const container = document.getElementById("admin-orders-list");
  if (!container) {
    return;
  }

  const currentUser = getCurrentUser();
  if (currentUser?.role !== "admin") {
    container.innerHTML = "<p>Admin order management is available after admin sign in.</p>";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/orders`, { headers: authHeaders() });
    const orders = await response.json();

    if (response.status === 401) {
      clearCurrentUser();
      container.innerHTML = "<p>Admin session expired. Please sign in again to view orders.</p>";
      return;
    }

    if (response.status === 403) {
      container.innerHTML = "<p>Admin access required to view orders.</p>";
      return;
    }

    if (!response.ok) {
      throw new Error(orders.message || "Unable to load orders");
    }

    renderOrders(container, orders, true);
  } catch (error) {
    container.innerHTML = "<p>Could not fetch orders. Please try signing in again.</p>";
  }
}
async function initOrders() {
  const container = document.getElementById("orders-list");
  if (!container) {
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser?.token) {
    container.innerHTML = "<p>Please sign in to view your orders.</p>";
    return;
  }

  const endpoint = currentUser.role === "admin" ? "/orders" : "/my-orders";

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { headers: authHeaders() });
    const orders = await response.json();

    if (response.status === 401) {
      clearCurrentUser();
      container.innerHTML = "<p>Your session expired. Please sign in again to view orders.</p>";
      return;
    }

    if (response.status === 403) {
      container.innerHTML = "<p>You do not have permission to view these orders.</p>";
      return;
    }

    if (!response.ok) {
      throw new Error(orders.message || "Unable to load orders");
    }

    renderOrders(container, orders, currentUser.role === "admin");
  } catch (error) {
    container.innerHTML = "<p>Could not fetch orders. Please try signing in again.</p>";
  }
}

function renderWishlist() {
  const container = document.getElementById("wishlist-items");
  if (!container) {
    return;
  }

  const wishlist = getWishlist();
  if (!wishlist.length) {
    container.innerHTML = "<p>Your wishlist is empty.</p>";
    return;
  }

  container.innerHTML = wishlist
    .map(
      (item, index) => {
        const imageUrl = resolveImageUrl(item.image || "");
        const imageMarkup = imageUrl
          ? `<img class="saved-item-thumb" src="${imageUrl}" alt="${escapeHtml(item.name)}">`
          : `<div class="saved-item-thumb saved-item-thumb--empty">No image</div>`;

        return `
          <div class="list-row saved-item-row">
            <div class="saved-item-media">
              ${imageMarkup}
              <div class="saved-item-body">
                <strong>${escapeHtml(item.name)}</strong>
                <div class="muted-text">$${Number(item.price).toFixed(2)}</div>
              </div>
            </div>
            <div class="saved-item-actions">
              <button class="secondary-btn" onclick="viewProduct(${jsonArg(item.id)})">Open</button>
              <button class="danger-btn" onclick="removeWishlist(${index})">Remove</button>
            </div>
          </div>
        `;
      }
    )
    .join("");
}
function initWishlistPage() {
  const container = document.getElementById("wishlist-items");
  if (!container) {
    return;
  }

  renderWishlist();
}

let chatbotProductsCache = [];
let cartReminderTimerId = null;
const CHATBOT_HINTS = [
  "show me products under $50",
  "show keyboards under 100$",
  "find brand logitech",
  "recommend for me",
  "where is my order",
  "apply coupon SAVE10",
  "add gaming mouse to cart",
  "remove mouse from cart",
  "shipping info",
  "return policy",
  "payment methods"
];

function trackProductInteraction(id, type) {
  const safeType = type === "view" ? "view" : "click";
  const key = safeType === "view" ? "viewedProducts" : "clickedProducts";
  const values = getScopedList(key);
  values.unshift(String(id));
  setScopedList(key, [...new Set(values)].slice(0, 100));
}

function normalizeChatTerm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\b(add|to|cart|product|item|this|that|the|please|image|picture|photo|a|an|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findProductByChatTerm(products, term) {
  const clean = normalizeChatTerm(term);
  if (!clean) {
    return null;
  }

  const words = clean.split(" ").filter(Boolean);
  const withHaystack = products.map((product) => {
    const haystack = `${product.name || ""} ${product.description || ""} ${product.slug || ""}`.toLowerCase();
    return { product, haystack };
  });

  const exact = withHaystack.find(({ haystack }) => haystack.includes(clean));
  if (exact) {
    return exact.product;
  }

  const tokenMatch = withHaystack.find(({ haystack }) => words.every((word) => haystack.includes(word)));
  if (tokenMatch) {
    return tokenMatch.product;
  }

  return null;
}

function formatProductMentions(products, heading) {
  if (!products.length) {
    return "";
  }

  const cards = products.map((product) => {
    const name = escapeHtml(product.name || "Product");
    const id = String(product._id || "");
    const price = Number(product.price || 0).toFixed(2);
    const image = resolveImageUrl(product.image || "");
    return `
      <div class="chatbot-product-card">
        <img class="chatbot-product-image" src="${image}" alt="${name}">
        <div class="chatbot-product-body">
          <strong>${name}</strong>
          <span>${price}</span>
          <div class="chatbot-product-actions">
            <button type="button" class="chatbot-product-btn" onclick="viewProduct('${id}')">Open Product</button>
            <button type="button" class="chatbot-product-btn secondary" onclick='addCart(${jsonArg(product._id)}, ${jsonArg(product.name)}, ${Number(product.price)}, ${jsonArg(product.image || "")})'>Add to Cart</button>
          </div>
        </div>
      </div>`;
  });

  return `[PRODUCT_LIST]\n<strong>${escapeHtml(heading)}:</strong><div class="chatbot-product-list">${cards.join("")}</div>`;
}

function formatBotMessage(text) {
  const raw = String(text || "");
  if (raw.startsWith("[PRODUCT_LIST]\n")) {
    return raw.replace("[PRODUCT_LIST]\n", "");
  }

  const escaped = escapeHtml(raw);
  const linked = escaped.replace(
    /Open:\s*(product\.html\?id=[a-z0-9]+)/gi,
    (match, p) => `Open: <a href="${p}" target="_self">${p}</a>`
  );

  return linked
    .replace(/\n/g, "<br>")
    .replace(/\s\|\s/g, " <span class=\"muted-text\">|</span> ");
}

function getAutocompleteSuggestions(query, products) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    return CHATBOT_HINTS.slice(0, 6);
  }

  const productMatches = products
    .map((product) => String(product.name || "").trim())
    .filter((name) => name && name.toLowerCase().includes(q))
    .slice(0, 5);

  const hintMatches = CHATBOT_HINTS.filter((hint) => hint.toLowerCase().includes(q));
  return [...new Set([...hintMatches, ...productMatches])].slice(0, 8);
}

function renderAutocompleteSuggestions(container, suggestions) {
  if (!container) {
    return;
  }

  if (!suggestions.length) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.innerHTML = suggestions
    .map((value) => `<button type="button" class="chatbot-suggestion" data-suggestion="${escapeHtml(value)}">${escapeHtml(value)}</button>`)
    .join("");
  container.classList.remove("hidden");
}

function inferCategory(product) {
  if (product.category) {
    return String(product.category).toLowerCase();
  }
  const text = `${product.name || ""} ${product.description || ""}`.toLowerCase();
  if (text.includes("mouse")) return "mouse";
  if (text.includes("keyboard")) return "keyboard";
  if (text.includes("headphone") || text.includes("earphone")) return "audio";
  if (text.includes("webcam")) return "webcam";
  if (text.includes("hub")) return "hub";
  return "general";
}

function inferBrand(product) {
  if (product.brand) {
    return String(product.brand).toLowerCase();
  }
  return String(product.name || "").trim().split(/\s+/)[0]?.toLowerCase() || "generic";
}

function inferRating(product) {
  const rating = Number(product.rating);
  if (Number.isFinite(rating) && rating > 0) {
    return rating;
  }
  return 4;
}

async function getAllProductsForAgent() {
  if (chatbotProductsCache.length) {
    return chatbotProductsCache;
  }
  const response = await fetch(`${API_BASE}/products`);
  const products = await response.json();
  if (response.ok && Array.isArray(products)) {
    chatbotProductsCache = products;
    return products;
  }
  return [];
}

function parseSearchFilters(text) {
  const lower = text.toLowerCase();
  const maxPrice = lower.match(/(?:under|below|less than)\s*\$?(\d+(?:\.\d+)?)\$?/i);
  const minPrice = lower.match(/(?:above|over|more than)\s*\$?(\d+(?:\.\d+)?)\$?/i);
  const rating = lower.match(/(?:rating|rated)\s*(?:above|over|at least|>=?)?\s*(\d(?:\.\d)?)/i);
  const brand = lower.match(/brand\s+([a-z0-9\-]+)/i);
  const category = lower.match(/(?:category|in)\s+([a-z\-\s]+)/i);
  const query = lower
    .replace(/show me|show|mwe|find|search|products?|under|below|less than|above|over|more than|rating|rated|brand|category|in|\$?\d+(?:\.\d+)?\$?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    maxPrice: maxPrice ? Number(maxPrice[1]) : null,
    minPrice: minPrice ? Number(minPrice[1]) : null,
    minRating: rating ? Number(rating[1]) : null,
    brand: brand ? brand[1].toLowerCase() : "",
    category: category ? category[1].trim().toLowerCase() : "",
    query
  };
}

function buildTrackingTimeline(status) {
  const current = String(status || "Processing");
  const idx = ORDER_TIMELINE.indexOf(current);
  return ORDER_TIMELINE.map((step, i) => `${i <= (idx < 0 ? 0 : idx) ? "[x]" : "[ ]"} ${step}`).join(" -> ");
}

function createChatbotUi() {
  if (document.getElementById("chatbot-fab")) {
    return null;
  }

  const fab = document.createElement("button");
  fab.id = "chatbot-fab";
  fab.type = "button";
  fab.textContent = "AI Help";

  const panel = document.createElement("section");
  panel.id = "chatbot-panel";
  panel.className = "hidden";
  panel.innerHTML = `
    <div class="chatbot-header">
      <strong>Shopping Assistant</strong>
      <button id="chatbot-close" type="button" aria-label="Close">x</button>
    </div>
    <div id="chatbot-messages" class="chatbot-messages"></div>
    <div class="chatbot-input-row">
      <input id="chatbot-input" type="text" list="chatbot-autocomplete" placeholder="Ask: show me products under $50" />
      <button id="chatbot-send" type="button">Send</button>
    </div>
    <datalist id="chatbot-autocomplete"></datalist>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  return { fab, panel };
}

function appendChatMessage(text, role) {
  const box = document.getElementById("chatbot-messages");
  if (!box) {
    return;
  }
  const item = document.createElement("div");
  item.className = `chatbot-msg ${role}`;
  if (role === "bot") {
    item.innerHTML = formatBotMessage(text);
  } else {
    item.textContent = text;
  }
  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
}

async function handleChatbotQuery(rawText) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  if (!text) {
    return "Please type a message.";
  }

  if (lower.includes("shipping")) {
    return "Shipping: Standard delivery is 3-5 business days, express delivery is 1-2 days.";
  }

  if (lower.includes("return")) {
    return "Return policy: You can return items within 7 days in original condition.";
  }

  if (lower.includes("payment")) {
    return "Payment methods: Credit card, debit card, and COD are supported in this sandbox setup.";
  }

  if (lower.startsWith("suggest ")) {
    const q = lower.replace("suggest ", "").trim();
    const products = await getAllProductsForAgent();
    const suggestions = products
      .filter((p) => String(p.name || "").toLowerCase().startsWith(q))
      .slice(0, 5)
      .map((p) => p.name);
    return suggestions.length
      ? `Suggestions: ${suggestions.join(", ")}`
      : "No suggestions found. Try another prefix.";
  }

  if (lower.includes("where is my order") || lower.includes("track order") || lower.includes("order status")) {
    const currentUser = getCurrentUser();
    if (!currentUser?.token) {
      return "Please sign in first, then I can fetch your live order status.";
    }

    try {
      const response = await fetch(`${API_BASE}/my-orders`, { headers: authHeaders() });
      const orders = await response.json();
      if (!response.ok || !Array.isArray(orders) || !orders.length) {
        return "I could not find any orders for your account.";
      }

      const trackMatch = text.match(/ITM-\d+/i);
      const order = trackMatch
        ? orders.find((o) => String(o.trackingNumber || "").toLowerCase() === trackMatch[0].toLowerCase()) || orders[0]
        : orders[0];

      return `Order ${order.trackingNumber || order._id}: ${order.status}. Timeline: ${buildTrackingTimeline(order.status)}`;
    } catch (error) {
      return "I could not fetch order status right now. Please try again.";
    }
  }

  if (lower.startsWith("apply coupon ")) {
    const code = text.replace(/apply coupon /i, "").trim().toUpperCase();
    if (!COUPON_MAP[code]) {
      return `Coupon ${code} is not valid. Available: ${Object.keys(COUPON_MAP).join(", ")}`;
    }
    setActiveCoupon(code);
    renderCart();
    const rate = Math.round(COUPON_MAP[code] * 100);
    return `Coupon ${code} applied. Discount: ${rate}%`;
  }

  if (lower.startsWith("remove ") && lower.includes("cart")) {
    const name = lower.replace("remove", "").replace("from cart", "").trim();
    const cart = getCart();
    const idx = cart.findIndex((item) => String(item.name || "").toLowerCase().includes(name));
    if (idx < 0) {
      return "Could not find that item in your cart.";
    }
    removeCart(idx);
    return `Removed ${cart[idx].name} from cart.`;
  }

  if (lower.startsWith("add ") && lower.includes("cart")) {
    const term = text;
    const products = await getAllProductsForAgent();
    const match = findProductByChatTerm(products, term);
    if (!match) {
      const examples = products.slice(0, 3).map((p) => p.name).join(", ");
      return `I could not match that product. Try: add <exact product name> to cart. Examples: ${examples}`;
    }
    addCart(match._id, match.name, match.price, match.image);
    return `Added ${match.name} to cart. Open: product.html?id=${match._id}`;
  }

  if (lower.includes("recommend") || lower.includes("also bought") || lower.includes("trending")) {
    const products = await getAllProductsForAgent();
    const viewed = getScopedList("viewedProducts");
    const clicked = getScopedList("clickedProducts");
    const currentUser = getCurrentUser();
    let purchasedIds = [];

    if (currentUser?.token) {
      try {
        const res = await fetch(`${API_BASE}/my-orders`, { headers: authHeaders() });
        const orders = await res.json();
        if (res.ok && Array.isArray(orders)) {
          purchasedIds = orders.flatMap((order) => (Array.isArray(order.products) ? order.products.map((item) => String(item.id || "")) : []));
        }
      } catch (error) {
        purchasedIds = [];
      }
    }

    const score = new Map();
    for (const p of products) {
      score.set(String(p._id), 0);
    }

    viewed.forEach((id, i) => score.set(String(id), (score.get(String(id)) || 0) + Math.max(5 - i, 1)));
    clicked.forEach((id, i) => score.set(String(id), (score.get(String(id)) || 0) + Math.max(7 - i, 2)));
    purchasedIds.forEach((id) => score.set(String(id), (score.get(String(id)) || 0) + 4));

    try {
      const trendingResponse = await fetch(`${API_BASE}/trending-products`);
      const trendingProducts = await trendingResponse.json();
      if (trendingResponse.ok && Array.isArray(trendingProducts)) {
        trendingProducts.forEach((product, index) => {
          const id = String(product._id || "");
          score.set(id, (score.get(id) || 0) + Math.max(6 - index, 1));
        });
      }
    } catch (error) {
      // Ignore trending signal errors and continue with local ranking.
    }

    const recommended = [...products]
      .sort((a, b) => (score.get(String(b._id)) || 0) - (score.get(String(a._id)) || 0))
      .slice(0, 3);

    if (!recommended.length) {
      return "No recommendations yet. Browse products first and I will personalize suggestions.";
    }

    return `${formatProductMentions(recommended, "Recommended for you")} | Tip: say 'add <product name> to cart'`;
  }

  if (/\b(show|search|find|lookup|list)\b/i.test(lower)) {
    const products = await getAllProductsForAgent();
    const filters = parseSearchFilters(text);

    const filtered = products.filter((product) => {
      const price = Number(product.price);
      const category = inferCategory(product);
      const brand = inferBrand(product);
      const rating = inferRating(product);
      const hay = `${product.name || ""} ${product.description || ""}`.toLowerCase();

      if (filters.maxPrice !== null && price > filters.maxPrice) return false;
      if (filters.minPrice !== null && price < filters.minPrice) return false;
      if (filters.minRating !== null && rating < filters.minRating) return false;
      if (filters.category && !category.includes(filters.category)) return false;
      if (filters.brand && !brand.includes(filters.brand)) return false;
      if (filters.query && !hay.includes(filters.query)) return false;
      return true;
    });

    if (!filtered.length) {
      const tips = products.slice(0, 3).map((p) => p.name).join(", ");
      return `No exact match found. Try: suggest m or search under $50. Popular products: ${tips}`;
    }

    const top = filtered.slice(0, 5);
    return `${formatProductMentions(top, `Found ${filtered.length} product(s)`)} | Tip: say 'add <product name> to cart'`;
  }

  return "I can help with search, recommendations, cart actions, coupons, tracking, shipping, returns, and payment FAQs.";
}

function startAbandonedCartReminder() {
  if (cartReminderTimerId) {
    clearInterval(cartReminderTimerId);
  }

  cartReminderTimerId = setInterval(() => {
    const cart = getCart();
    if (!cart.length) {
      return;
    }

    const updatedAt = Number(localStorage.getItem(storageKey("cartUpdatedAt")) || 0);
    const remindedAt = Number(localStorage.getItem(storageKey("cartRemindedAt")) || 0);
    const now = Date.now();

    if (updatedAt && now - updatedAt > 120000 && now - remindedAt > 120000) {
      appendChatMessage("You still have items in your cart. I can help you checkout or apply a coupon.", "bot");
      localStorage.setItem(storageKey("cartRemindedAt"), String(now));
    }
  }, 30000);
}

function populateChatbotAutocomplete(input, list, products) {
  if (!input || !list) {
    return;
  }

  const q = String(input.value || "").trim().toLowerCase();
  const hintMatches = CHATBOT_HINTS.filter((hint) => !q || hint.toLowerCase().includes(q));
  const productMatches = (products || [])
    .map((product) => String(product.name || "").trim())
    .filter((name) => name && (!q || name.toLowerCase().includes(q)))
    .slice(0, 8);

  const suggestions = [...new Set([...hintMatches, ...productMatches])].slice(0, 10);
  list.innerHTML = suggestions.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}
function initChatbotAgent() {
  const ui = createChatbotUi();
  if (!ui) {
    return;
  }

  const { fab, panel } = ui;
  const input = document.getElementById("chatbot-input");
  const sendButton = document.getElementById("chatbot-send");
  const closeButton = document.getElementById("chatbot-close");
  const autocompleteList = document.getElementById("chatbot-autocomplete");
  let hintBubble = null;

  const dismissHint = () => {
    if (hintBubble) {
      hintBubble.remove();
      hintBubble = null;
    }
    fab.classList.remove("chatbot-pulse");
      };

  const refreshAutocomplete = async () => {
    const products = await getAllProductsForAgent();
    populateChatbotAutocomplete(input, autocompleteList, products);
  };
  hintBubble = document.createElement("div");
  hintBubble.id = "chatbot-hint";
  hintBubble.textContent = "Ask me anything";
  document.body.appendChild(hintBubble);
  fab.classList.add("chatbot-pulse");
  // Keep the hint visible longer so users notice it before interacting.
  setTimeout(dismissHint, 25000);


  const onSend = async () => {
    const text = input.value.trim();
    if (!text) {
      return;
    }

    appendChatMessage(text, "user");
    input.value = "";
    if (autocompleteList) { autocompleteList.innerHTML = ""; }

    const response = await handleChatbotQuery(text);
    appendChatMessage(response, "bot");
  };

  fab.addEventListener("click", () => {
    panel.classList.remove("hidden");
    input.focus();
    refreshAutocomplete();
    dismissHint();
  });

  closeButton.addEventListener("click", () => {
    panel.classList.add("hidden");
    dismissHint();
  });

  sendButton.addEventListener("click", onSend);
  input.addEventListener("input", refreshAutocomplete);
  input.addEventListener("focus", refreshAutocomplete);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSend();
    }
  });

  appendChatMessage("Hi! Ask me things like: 'show me products under $50', 'recommend for me', 'where is my order', 'apply coupon SAVE10'.", "bot");
  startAbandonedCartReminder();
}
function updateNavigation() {
  const currentUser = getCurrentUser();
  const authLink = document.getElementById("auth-nav-link");
  if (!authLink) {
    return;
  }

  if (currentUser?.token) {
    authLink.innerHTML = '<a href="#" onclick="logoutUser(); return false;">Logout</a>';
  } else {
    authLink.innerHTML = '<a href="login.html">Login</a>';
  }
}
function logoutUser() {
  const currentUser = getCurrentUser();
  if (currentUser?.token) {
    fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: authHeaders()
    }).catch(() => null);
  }
  clearCurrentUser();
  window.location = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavigation();
  loadProducts();
  initProductDetails();
  initCartPage();
  initRegister();
  initLogin();
  initAdmin();
  initOrders();
  initWishlistPage();
  initChatbotAgent();
});

window.viewProduct = viewProduct;
window.addCart = addCart;
window.removeCart = removeCart;
window.addWishlist = addWishlist;
window.removeWishlist = removeWishlist;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.logoutUser = logoutUser;










































