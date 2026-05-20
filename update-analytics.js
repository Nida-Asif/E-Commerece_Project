const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'ai-analytics.html');
let content = fs.readFileSync(filePath, 'utf-8');

// Find the cards array and insert the new user metrics cards
// We'll look for the pattern where "Total Products" ends and insert user metrics
const pattern = /(\{ icon: "[^"]+", value: summary\.totalProducts, label: "Total Products" \},\n      \{)/;
const replacement = `{ icon: "??", value: summary.totalUsers || 0, label: "Total Users" },
      { icon: "??", value: summary.totalAdmins || 1, label: "Admin Users" },
      {`;

if (pattern.test(content)) {
  content = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('? Successfully added user metrics cards');
  
  // Verify the change
  const updatedContent = fs.readFileSync(filePath, 'utf-8');
  if (updatedContent.includes('Total Users')) {
    console.log('? Verified: Total Users card added');
  }
} else {
  console.log('? Could not find pattern to replace');
  // Let's just find where Total Products is and show context
  const idx = content.indexOf('Total Products');
  if (idx > 0) {
    console.log('Found Total Products at position', idx);
    console.log('Context:');
    console.log(content.substring(idx - 50, idx + 150));
  }
}
