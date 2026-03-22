const fs = require('fs');

try {
  let content = fs.readFileSync('App.tsx', 'utf8');

  // Replace desktop nav array to exactly 5 elements
  let oldNavArray = `          {[
            { v: 'Dashboard', i: 'grid_view', l: 'Inicio' },
            { v: 'Alumnos', i: 'group', l: 'Gimnastas' },
            { v: userRole === 'Coordinator' ? 'Profesores' : 'Horario', i: userRole === 'Coordinator' ? 'badge' : 'calendar_today', l: userRole === 'Coordinator' ? 'Staff' : 'Horario' },
            { v: 'Asistente', i: 'smart_toy', l: 'IA' },
            { v: 'KnowledgeBase', i: 'book', l: 'Manuales' },
            { v: 'Ajustes', i: 'app_settings_alt', l: 'Ajustes' }
          ].map(item => (`

  let newNavArray = `          {[
            { v: 'Dashboard', i: 'grid_view', l: 'Inicio' },
            { v: 'Alumnos', i: 'group', l: 'Gimnastas' },
            { v: 'Clases', i: 'history', l: 'Clases' },
            { v: 'Asistente', i: 'smart_toy', l: 'IA' },
            { v: 'KnowledgeBase', i: 'book', l: 'Manuales' }
          ].map(item => (`
  
  if (content.includes(oldNavArray)) {
    content = content.replace(oldNavArray, newNavArray);
  } else {
    console.log("oldNavArray not found, maybe slightly different formatting.");
    // Fallback regex replacement for the array block
    const regex = /\{\[\s*\{\s*v:\s*'Dashboard'[\s\S]*?\]\.map\(item => \(/;
    content = content.replace(regex, newNavArray);
  }

  // Replace mobile nav entirely
  const oldMobileNavRegex = /<nav className="fixed bottom-0 left-0 right-0 bg-antigravity-black\/80 backdrop-blur-xl border-t border-white\/5 px-6 py-3 flex justify-between items-center z-50 md:hidden">[\s\S]*?<\/nav>/;
  
  const newMobileNav = `<nav className="fixed bottom-0 left-0 right-0 bg-antigravity-black/80 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-between items-center z-50 md:hidden">
        <button onClick={() => setVista('Dashboard')} className={\`flex flex-col items-center gap-1 transition-all \${vista === 'Dashboard' ? 'text-primary' : 'text-white/40'}\`}>
          <span className="material-icons-outlined text-xl">dashboard</span>
          <span className="text-[8px] font-black uppercase tracking-widest">Inicio</span>
        </button>
        <button onClick={() => { setAlumnosFilterMode('all'); setVista('Alumnos'); }} className={\`flex flex-col items-center gap-1 transition-all \${vista === 'Alumnos' ? 'text-primary' : 'text-white/40'}\`}>
          <span className="material-icons-outlined text-xl">groups</span>
          <span className="text-[8px] font-black uppercase tracking-widest">Gimnastas</span>
        </button>
        <button onClick={() => setVista('Clases')} className={\`flex flex-col items-center gap-1 transition-all \${vista === 'Clases' ? 'text-primary' : 'text-white/40'}\`}>
          <span className="material-icons-outlined text-xl">history</span>
          <span className="text-[8px] font-black uppercase tracking-widest">Clases</span>
        </button>
        <button onClick={() => setVista('Asistente')} className={\`flex flex-col items-center gap-1 transition-all \${vista === 'Asistente' ? 'text-primary' : 'text-white/40'}\`}>
          <span className="material-icons-outlined text-[22px]">smart_toy</span>
          <span className="text-[8px] font-black uppercase tracking-widest">IA</span>
        </button>
        <button onClick={() => setVista('KnowledgeBase')} className={\`flex flex-col items-center gap-1 transition-all \${vista === 'KnowledgeBase' ? 'text-primary' : 'text-white/40'}\`}>
          <span className="material-icons-outlined text-[22px]">book</span>
          <span className="text-[8px] font-black uppercase tracking-widest">Manuales</span>
        </button>
      </nav>`;

  content = content.replace(oldMobileNavRegex, newMobileNav);

  // Unificar pantalla Manuales: upload pdf error check, word message check
  content = content.replace(
    /if \(file\.type !== 'application\/pdf'\) \{/g,
    "if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) { alert('Las imágenes dentro del documento no serán leídas por el asistente, solo el texto.'); } else if (file.type !== 'application/pdf') {"
  );

  content = content.replace(
    /alert\('Solo se permiten archivos PDF'\);/g,
    "alert('El archivo es demasiado grande o no se pudo leer. Por favor probá con un PDF más pequeño.');"
  );

  fs.writeFileSync('App.tsx', content);
  console.log("Success modified App.tsx");
} catch(e) {
  console.error(e);
}
