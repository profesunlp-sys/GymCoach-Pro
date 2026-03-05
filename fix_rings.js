const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');
content = content.replace(/ring-1 ring-neon-blue\/50/g, 'focus:ring-1 focus:ring-neon-blue/50');
fs.writeFileSync('App.tsx', content);
console.log('Fixed rings');
