/**
 * Offline Smart Content Generator
 * Generates SEO-optimized content without external API dependency
 */

// ─── Keyword & Category Database ──────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  "Keyboards": ["keyboard", "mechanical", "typing", "gaming", "keycaps", "switches", "tactile"],
  "Mice": ["mouse", "wireless", "gaming", "precision", "ergonomic", "dpi", "tracking"],
  "Headphones": ["headphones", "audio", "wireless", "bluetooth", "sound", "call", "bass"],
  "Webcams": ["webcam", "camera", "1080p", "streaming", "video", "call", "recording"],
  "Hubs": ["hub", "usb", "type-c", "port", "adapter", "connectivity", "expansion"],
  "Mousepads": ["mousepad", "pad", "gaming", "surface", "desk", "xl", "extended"],
  "Monitors": ["monitor", "display", "screen", "resolution", "refresh", "curved"],
  "Stands": ["stand", "holder", "phone", "laptop", "desk", "mount"],
  "Cables": ["cable", "usb", "hdmi", "charger", "power", "connector"],
  "Lighting": ["light", "led", "rgb", "lamp", "desk", "illumination"]
};

const SEO_TEMPLATES = {
  keyboard: {
    title: (name) => `Best ${name} - Gaming & Productivity Keyboards`,
    description: (name) => `Shop premium ${name} for gaming, coding, and office work. Ergonomic, responsive, and durable.`,
    keywords: ["mechanical keyboard", "gaming keyboard", "keyboard", "typing", "productivity"]
  },
  mouse: {
    title: (name) => `${name} - Precision Gaming & Office Mouse`,
    description: (name) => `Experience smooth, accurate tracking with ${name}. Perfect for gaming, design, and everyday use.`,
    keywords: ["wireless mouse", "gaming mouse", "mouse", "precision", "tracking"]
  },
  headphones: {
    title: (name) => `${name} - Premium Wireless Headphones`,
    description: (name) => `Enjoy crystal-clear audio with ${name}. Comfortable fit, long battery, and immersive sound quality.`,
    keywords: ["wireless headphones", "bluetooth headphones", "audio", "sound", "headphones"]
  },
  webcam: {
    title: (name) => `${name} - Full HD 1080p Webcam for Streaming`,
    description: (name) => `Upgrade your video calls with ${name}. Sharp 1080p video, clear audio, and easy setup.`,
    keywords: ["webcam", "1080p camera", "streaming webcam", "video call", "HD camera"]
  },
  hub: {
    title: (name) => `${name} - USB-C Multi-Port Hub`,
    description: (name) => `Connect more devices with ${name}. Fast data transfer, charging, and display support.`,
    keywords: ["usb-c hub", "multi-port hub", "type-c adapter", "connectivity", "hub"]
  },
  mousepad: {
    title: (name) => `${name} - Professional Gaming Mousepad`,
    description: (name) => `Precision surface for gaming and productivity. ${name} delivers smooth mouse control.`,
    keywords: ["gaming mousepad", "mouse pad", "desk accessory", "precision surface"]
  },
  default: {
    title: (name) => `${name} - Premium IT Accessories`,
    description: (name) => `Shop quality ${name} for work, gaming, and productivity. Reliable, durable, and affordable.`,
    keywords: ["IT accessories", "tech gadgets", "productivity", "gaming"]
  }
};

function extractKeywords(text, maxCount = 5) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3);
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

function detectCategory(name, description) {
  const text = (name + " " + description).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter(kw => text.includes(kw)).length;
    if (matches >= 2) return category;
  }
  return "IT Accessories";
}

function getSeoTemplate(name, description) {
  const text = (name + " " + description).toLowerCase();
  if (text.includes("keyboard")) return SEO_TEMPLATES.keyboard;
  if (text.includes("mouse") && !text.includes("mousepad")) return SEO_TEMPLATES.mouse;
  if (text.includes("headphone") || text.includes("headset")) return SEO_TEMPLATES.headphones;
  if (text.includes("webcam") || text.includes("camera")) return SEO_TEMPLATES.webcam;
  if (text.includes("hub") || text.includes("port")) return SEO_TEMPLATES.hub;
  if (text.includes("mousepad") || text.includes("pad")) return SEO_TEMPLATES.mousepad;
  return SEO_TEMPLATES.default;
}

function generateSeoTitle(name, description) {
  const template = getSeoTemplate(name, description);
  let title = template.title(name);
  if (title.length > 60) {
    title = title.substring(0, 57) + "...";
  }
  return title;
}

function generateMetaDescription(name, description) {
  const template = getSeoTemplate(name, description);
  let metaDesc = template.description(name || description.substring(0, 20));
  if (metaDesc.length > 155) {
    metaDesc = metaDesc.substring(0, 152) + "...";
  }
  return metaDesc;
}

function generateMetaKeywords(name, description) {
  const template = getSeoTemplate(name, description);
  const baseKeywords = template.keywords.slice(0, 3);
  const extracted = extractKeywords(name + " " + description, 2);
  const allKeywords = [...baseKeywords, ...extracted];
  const unique = [...new Set(allKeywords)].slice(0, 5);
  return unique.join(", ");
}

function generateSlug(name, description) {
  const text = (name || description).toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text.substring(0, 50);
}

function generateShortDescription(name, description) {
  if (!description) {
    return `High-quality ${name} for professional and personal use.`;
  }
  const words = description.split(/\s+/);
  let shortDesc = words.slice(0, 20).join(" ");
  if (words.length > 20) {
    shortDesc += "...";
  }
  if (shortDesc.length > 120) {
    shortDesc = shortDesc.substring(0, 117) + "...";
  }
  return shortDesc;
}

function generateProductTags(name, description) {
  const category = detectCategory(name, description);
  const keywords = extractKeywords(name + " " + description, 3);
  const tags = [category, ...keywords];
  return tags.slice(0, 5);
}

function generateSuggestedCategory(name, description) {
  return detectCategory(name, description);
}

function generateProductFeatures(name, description) {
  const features = [];
  const text = (name + " " + description).toLowerCase();
  const featureMap = {
    "wireless": "📡 Wireless Connectivity",
    "fast": "⚡ Fast Performance",
    "durable": "🛡️ Durable Design",
    "portable": "🎒 Portable & Compact",
    "ergonomic": "🪑 Ergonomic Design",
    "premium": "⭐ Premium Quality",
    "easy setup": "🔧 Easy Setup",
    "compatible": "🔌 Universal Compatibility",
    "long battery": "🔋 Long Battery Life",
    "high speed": "🚀 High-Speed Transfer"
  };
  for (const [keyword, feature] of Object.entries(featureMap)) {
    if (text.includes(keyword)) {
      features.push(feature);
    }
  }
  if (features.length < 3) {
    features.push("✨ Professional Grade");
    features.push("💎 Quality Assured");
  }
  return features.slice(0, 5);
}

function generateProductContent(name, description) {
  const cleanName = String(name || "").trim();
  const cleanDesc = String(description || "").trim();
  if (!cleanName && !cleanDesc) {
    return {
      error: "Product name or description is required",
      seoTitle: "",
      metaDescription: "",
      metaKeywords: ""
    };
  }
  return {
    seoTitle: generateSeoTitle(cleanName, cleanDesc),
    metaDescription: generateMetaDescription(cleanName, cleanDesc),
    metaKeywords: generateMetaKeywords(cleanName, cleanDesc),
    slug: generateSlug(cleanName, cleanDesc),
    shortDescription: generateShortDescription(cleanName, cleanDesc),
    tags: generateProductTags(cleanName, cleanDesc),
    suggestedCategory: generateSuggestedCategory(cleanName, cleanDesc),
    features: generateProductFeatures(cleanName, cleanDesc)
  };
}

function generateAnalyticsSummary(summary, topProduct, peakMonth) {
  const totalOrders = summary?.totalOrders || 0;
  const totalRevenue = summary?.totalRevenue || 0;
  const avgOrderValue = summary?.avgOrderValue || 0;
  const draftCount = summary?.draftCount || 0;
  const topProductName = topProduct !== "N/A" ? topProduct : "multiple products";
  const peakMonthName = peakMonth?.month || "this period";
  const parts = [];
  if (totalOrders > 0) {
    parts.push(`Your store has processed ${totalOrders} orders, generating $${totalRevenue.toFixed(2)} in revenue with an average order value of $${avgOrderValue.toFixed(2)}.`);
  } else {
    parts.push(`No orders yet, but your store is ready to accept customers.`);
  }
  if (topProduct !== "N/A") {
    parts.push(`${topProductName} is your best-selling product and should be highlighted.`);
  }
  if (draftCount > 0) {
    parts.push(`You have ${draftCount} draft products waiting to be published.`);
  }
  return parts.join(" ");
}

function generateAnalyticsRecommendations(topProducts, highPerf, lowPerf) {
  const recommendations = [
    {
      icon: "🚀",
      text: "Optimize your best-selling products with better product images and detailed descriptions to boost conversion rates."
    },
    {
      icon: "💰",
      text: "Create bundle deals combining complementary products to increase average order value and customer satisfaction."
    },
    {
      icon: "📦",
      text: "Review inventory rotation for slow-moving items and consider seasonal promotions to clear stock."
    },
    {
      icon: "📝",
      text: "Ensure all draft products have SEO-optimized titles and descriptions before publishing to the store."
    },
    {
      icon: "📈",
      text: "Analyze seasonal trends in your sales data to plan targeted marketing campaigns for peak months."
    }
  ];
  if (lowPerf && lowPerf.length > 0) {
    recommendations[2].text = `Try giving "${lowPerf[0]}" a special discount or featured placement to boost its sales.`;
  }
  if (topProducts && topProducts.length > 0) {
    recommendations[0].text = `"${topProducts[0].name}" is your top seller - create a similar product or upsell complementary items.`;
  }
  return recommendations.slice(0, 5);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateProductContent,
    generateAnalyticsSummary,
    generateAnalyticsRecommendations,
    generateSeoTitle,
    generateMetaDescription,
    generateMetaKeywords,
    generateSlug,
    generateShortDescription,
    generateProductTags,
    generateSuggestedCategory,
    generateProductFeatures,
    detectCategory,
    extractKeywords
  };
}
