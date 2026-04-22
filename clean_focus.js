const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');
content = content.replace(/focus:\s*focus:\s*/g, '');
content = content.replace(/focus:\s*/g, '');
fs.writeFileSync('App.tsx', content);
console.log('Cleaned');
