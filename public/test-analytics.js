const mongoose = require("mongoose");
const MONGO_URI = "mongodb://127.0.0.1:27017/it_accessories_market";

const productSchema = new mongoose.Schema({
  name: String, price: Number,
  priceHistory: [{ price: Number, changedAt: Date, changedBy: String, note: String }]
});

const Product = mongoose.model("Product", productSchema);

mongoose.connect(MONGO_URI).then(async () => {
  const products = await Product.find().lean();
  console.log("Total products:", products.length);
  const withHistory = products.filter(p => (p.priceHistory || []).length >= 2);
  console.log("Products with 2+ price changes:", withHistory.length);
  withHistory.slice(0, 3).forEach(p => {
    console.log(${p.name}:  entries);
  });
  process.exit(0);
}).catch(e => { console.error("Error:", e.message); process.exit(1); });
