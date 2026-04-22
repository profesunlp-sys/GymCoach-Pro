const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// We want to replace border classes inside <input, <select, <textarea tags.
// A regex to match these tags and their className attributes.
// Using [\s\S] instead of . to match newlines.

content = content.replace(/<(input|select|textarea)([\s\S]*?)className=(["'])([\s\S]*?)\3([\s\S]*?)>/g, (match, tag, before, quote, classes, after) => {
    
    let newClasses = classes;
    
    // Remove existing border colors and focus rings
    newClasses = newClasses.replace(/border-white\/\d+/g, '');
    newClasses = newClasses.replace(/border-rose-500\/\d+/g, '');
    newClasses = newClasses.replace(/border-transparent/g, '');
    newClasses = newClasses.replace(/border-none/g, '');
    newClasses = newClasses.replace(/focus:border-\w+\/\d+/g, '');
    newClasses = newClasses.replace(/focus:ring-\w+\/\d+/g, '');
    newClasses = newClasses.replace(/focus:ring-1/g, '');
    newClasses = newClasses.replace(/ring-\w+\/\d+/g, '');
    newClasses = newClasses.replace(/neon-border-cyan/g, '');
    newClasses = newClasses.replace(/border-neon-blue/g, '');
    newClasses = newClasses.replace(/focus:border-neon-blue/g, '');
    newClasses = newClasses.replace(/focus:ring-neon-blue\/\d+/g, '');
    newClasses = newClasses.replace(/outline-none/g, '');
    
    // Add the new classes
    // Make sure 'border' is there
    if (!newClasses.includes('border ')) {
        newClasses += ' border';
    }
    
    // If it's a checkbox, don't add border-neon-blue
    if (before.includes('type="checkbox"') || after.includes('type="checkbox"')) {
        return match;
    }
    
    newClasses += ' border-neon-blue focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/50 outline-none';
    
    // Clean up multiple spaces
    newClasses = newClasses.replace(/\s+/g, ' ').trim();
    
    return `<${tag}${before}className=${quote}${newClasses}${quote}${after}>`;
});

fs.writeFileSync('App.tsx', content);
console.log('Done');
