const fs = require('fs');

try {
  let content = fs.readFileSync('App.tsx', 'utf8');

  // Mejora 3
  content = content.replace(
    '<div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Accesos Rápidos</h3></div>',
    '<div className="flex flex-col px-1"><h3 className="text-white font-bold text-lg">Accesos Rápidos</h3><p className="text-[10px] text-white/50 mt-1">Empezá por Lista de Asistencia para registrar la clase de hoy.</p></div>'
  );

  content = content.replace(
    /className="glass-card rounded-3xl p-5 border border-white\/5 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"/,
    'className="glass-card rounded-3xl p-5 border-2 border-neon-cyan flex flex-col items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"'
  ); 

  content = content.replace(
    '<span className="text-xs font-bold text-white text-center">Datos de Alumnos</span>',
    '<span className="text-xs font-bold text-white text-center flex flex-col items-center gap-1">Datos de Alumnos<span className="text-[9px] text-white/50 font-medium mt-1">Ver gimnastas</span></span>'
  );

  content = content.replace(
    '<span className="text-xs font-bold text-white text-center">Obs. de Salud</span>',
    '<span className="text-xs font-bold text-white text-center flex flex-col items-center gap-1">Obs. de Salud<span className="text-[9px] text-white/50 font-medium mt-1">Registro médico</span></span>'
  );

  content = content.replace(
    '<span className="text-xs font-bold text-white text-center">Estadísticas</span>',
    '<span className="text-xs font-bold text-white text-center flex flex-col items-center gap-1">Estadísticas<span className="text-[9px] text-white/50 font-medium mt-1">Ver reportes</span></span>'
  );

  content = content.replace(
    '<span className="text-xs font-bold text-white text-center">Historial Clases</span>',
    '<span className="text-xs font-bold text-white text-center flex flex-col items-center gap-1">Historial Clases<span className="text-[9px] text-white/50 font-medium mt-1">Clases anteriores</span></span>'
  );

  content = content.replace(
    '<span className="text-xs font-bold text-white text-center">Emergencias</span>',
    '<span className="text-xs font-bold text-white text-center">Contactos de Emergencia</span>'
  );

  // Mejora 4
  content = content.replace(
    "`Base de Datos ${userRole === 'Coordinator' ? 'Global' : 'del Grupo'}`",
    "'Tus alumnas registradas'"
  );

  content = content.replace(
    'className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white/60 hover:text-white transition-all h-[26px] flex items-center gap-1"',
    'className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-xs text-white/80 hover:text-white transition-all flex items-center gap-2 shadow-sm"'
  );

  // Mejora 5
  content = content.replace(
    '<div className="flex justify-between items-center">\n                <h3 className="text-accent-purple font-bold text-lg active-glow">\n                  {editingGroup ? \'Editar Grupo\' : \'Configuración de Horario\'}\n                </h3>',
    '<div className="flex flex-col items-start">\n                <div className="flex justify-between w-full items-center">\n                  <h3 className="text-accent-purple font-bold text-2xl active-glow">\n                    {editingGroup ? \'Editar Grupo\' : \'Crear Nuevo Grupo\'}\n                  </h3></div>\n                  <p className="text-[10px] text-white/60 mt-2">Completá estos datos para crear un grupo nuevo. Solo necesitás hacerlo una vez por grupo.</p>'
  );

  content = content.replace(
    '<div className="flex justify-between px-1"><h3 className="text-white font-bold text-lg">Mis Grupos</h3></div>',
    '<div className="flex justify-between px-1"><h3 className="text-white font-bold text-2xl">Mis Grupos</h3></div>'
  );

  content = content.replace(
    'className="text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center"',
    'className="text-primary bg-primary/10 p-4 rounded-xl border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center"'
  );
  content = content.replace(
    '<span className="material-icons-outlined text-[16px]">edit</span>',
    '<span className="material-icons-outlined text-[24px]">edit</span>'
  );

  content = content.replace(
    'className="text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center"',
    'className="text-rose-500 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center"'
  );
  content = content.replace(
    '<span className="material-icons-outlined text-[16px]">delete</span>',
    '<span className="material-icons-outlined text-[24px]">delete</span>'
  );

  content = content.replace(
    '<div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider shadow-neon-cyan uppercase">Active</div>',
    '<div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg border border-primary/20 tracking-wider shadow-neon-cyan uppercase">Activo</div>'
  );

  // Mejora 6
  let backupExportStr = '<div className="flex flex-col items-start"><span className="text-xs font-medium text-white">Guardar mis datos</span><span className="text-[9px] text-white/50 font-normal mt-0.5">Guardá una copia de toda tu información.</span></div>';
  content = content.replace(
    '<span className="text-xs font-medium text-white">Exportar Copia de Seguridad</span>',
    backupExportStr
  );

  let backupImportStr = '<div className="flex flex-col items-start"><span className="text-xs font-medium text-white">Recuperar mis datos</span><span className="text-[9px] text-white/50 font-normal mt-0.5">Restaurá información guardada anteriormente.</span></div>';
  content = content.replace(
    '<span className="text-xs font-medium text-white">Importar Copia de Seguridad</span>',
    backupImportStr
  );

  content = content.replace(
    '<p className="text-[9px] font-black uppercase tracking-[0.5em] text-white mb-2">GymCoach Pro v2.0 Cloud</p>',
    ''
  );
  content = content.replace(
    '<p className="text-[10px] text-white/60">Desarrollado para la excelencia gimnástica.</p>',
    ''
  );

  // Mejora 7
  content = content.replaceAll('>Stats<', '>Estadísticas<');
  content = content.replaceAll(/>Loading\.\.\.</gi, '>Cargando...<');
  content = content.replaceAll(/>Submit</gi, '>Confirmar<');
  content = content.replaceAll(/>Active</gi, '>Activo<');

  fs.writeFileSync('App.tsx', content);
  console.log("Success");
} catch(e) {
  console.error(e);
}
