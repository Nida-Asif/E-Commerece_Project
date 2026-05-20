# IT Accessories Marketplace — Complete Project

## Requirements
- Node.js v18+
- MongoDB (running locally on port 27017)

## Setup & Run

```bash
# 1. Install dependencies (already included in zip)
npm install

# 2. Start the server
npm start
```

## Open in Browser
```
http://localhost:3000
```

## Admin Login
- Email: admin@itmarket.local
- Password: Admin@12345

## AI Analytics Dashboard
```
http://localhost:3000/ai-analytics.html
```

## New Features Added
1. **Inventory Control** — Real stock tracking, low stock alerts, out-of-stock detection
2. **Category Sales Forecast** — AI predicts which categories will sell more next 30 days
3. **Price History Charts** — Track every price change over time with Chart.js
4. **AI Price Drop Suggestions** — If price increased >25% but sales are low, AI recommends dropping price
5. **Auto Stock Deduction** — When order is placed, stock automatically decreases
6. **Category Field** — Products now have category (Keyboards, Mice, Headphones, etc.)

## Project Structure
```
it-accessories-marketplace/
├── server.js              ← Main backend (Express + MongoDB)
├── ai-content-generator.js ← Offline AI for SEO/keywords
├── package.json
├── .env
├── public/
│   ├── index.html         ← Home page
│   ├── products.html      ← Product listing
│   ├── product.html       ← Product detail
│   ├── cart.html          ← Shopping cart
│   ├── admin.html         ← Admin panel (manage products/orders)
│   ├── ai-analytics.html  ← AI Dashboard (NEW features here)
│   ├── login.html
│   ├── register.html
│   ├── orders.html
│   ├── wishlist.html
│   ├── script.js          ← Frontend JavaScript
│   ├── style.css          ← Styles
│   └── images/            ← Product images
└── node_modules/          ← Dependencies (already installed)
```
