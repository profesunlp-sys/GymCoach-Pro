const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace border-white/5, border-white/10, border-white/20 with border-neon-blue in input, select, textarea
  // We look for className="..." and then find tags.
  // A simpler way: replace common patterns.
  
  const tags = ['input', 'select', 'textarea'];
  
  tags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*?class(Name)?="([^"]*?)"`, 'gs');
    content = content.replace(regex, (match, p1, p2) => {
      let classes = p2;
      if (!classes.includes('border-neon-blue')) {
        // Remove existing border classes if they conflict
        classes = classes.replace(/border-white\/\d+/g, '');
        classes = classes.replace(/border-slate-\d+\/\d+/g, '');
        if (!classes.includes('border')) {
           classes += ' border';
        }
        classes += ' border-neon-blue';
      }
      
      if (!classes.includes('focus:border-neon-blue')) {
        classes += ' focus:border-neon-blue';
      }
      if (!classes.includes('focus:ring-1')) {
        classes += ' focus:ring-1';
      }
      if (!classes.includes('focus:ring-neon-blue/50')) {
        classes += ' focus:ring-neon-blue/50';
      }
      if (!classes.includes('outline-none')) {
        classes += ' outline-none';
      }
      
      return match.replace(p2, classes.trim().replace(/\s+/g, ' '));
    });
  });

  fs.writeFileSync(filePath, content);
}

fixFile('App.tsx');
fixFile('src/components/CoachAI.tsx');
console.log('Fixed borders in App.tsx and CoachAI.tsx');
