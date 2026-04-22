const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');
content = content.replace(/border-neon-blue\s+border-neon-blue/g, 'border-neon-blue focus:border-neon-blue');
fs.writeFileSync('App.tsx', content);
console.log('Cleaned duplicates');
