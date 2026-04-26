
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alumno, GrupoConfig, ViewMode, AsistenciaRecord, Clase } from '../../types';

interface AsistenciaProps {
  vista: ViewMode;
  setVista: (vista: ViewMode) => void;
  activeGroup: GrupoConfig | null;
  setActiveGroup: (group: GrupoConfig | null) => void;
  reportMonth: number;
  reportYear: number;
  loadMonthlyReport: (grupo: string, mes: number, anio: number) => void;
  setEditingGroup: (group: GrupoConfig | null) => void;
  setNewGroupName: (name: string) => void;
  setNewCoachName: (name: string) => void;
  setSelectedDays: (days: string[]) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  presentCount: number;
  filteredAlumnos: Alumno[];
  handleNavigation: (vista: ViewMode) => void;
  handleAIAnalysis: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedAlumnoId: string | null;
  setExpandedAlumnoId: (id: string | null) => void;
  asistenciasHoy: Record<string, boolean>;
  pagosHoy: Record<string, boolean>;
  togglePayment: (alumnoId: string) => void;
  toggleAttendance: (alumnoId: string) => void;
  asistenciasClase: AsistenciaRecord[];
  isLoadingAsistenciasClase: boolean;
  handleDeleteAsistencia: (asistencia: AsistenciaRecord) => void;
  handleEditAsistencia: (asistencia: AsistenciaRecord) => void;
  asistenciasGlobales: Record<string, { presentes: number, total: number }>;
  alumnos: Alumno[];
  grupos: GrupoConfig[];
  isAnalyzing: boolean;
  comparativeData: any[];
  handleExportAttendance: () => void;
  handleExportGroupAttendance: (groupName: string) => void;
  handleExportAllAttendance: () => void;
  studentForm: Partial<Alumno>;
  setStudentForm: (f: Partial<Alumno>) => void;
  handleSaveStudent: () => void;
  isSavingStudent: boolean;
  isLoadingMonthly: boolean;
  monthlyStats: Record<string, { attended: number, expected: number }>;
  setReportMonth: (m: number) => void;
  setReportYear: (y: number) => void;
  clases: Clase[];
  asistencias: AsistenciaRecord[];
  selectedDisciplina: string;
  setSelectedDisciplina: (d: string) => void;
  planesFilterDate: string;
  setPlanesFilterDate: (d: string) => void;
  planesFilterCoach: string;
  setPlanesFilterCoach: (c: string) => void;
  setSelectedAlumno: (alumno: Alumno) => void;
}

import { BulkPaymentImport } from './BulkPaymentImport';

export const Asistencia: React.FC<AsistenciaProps> = ({
  vista,
  setVista,
  activeGroup,
  setActiveGroup,
  reportMonth,
  reportYear,
  loadMonthlyReport,
  setEditingGroup,
  setNewGroupName,
  setNewCoachName,
  setSelectedDays,
  setStartTime,
  setEndTime,
  presentCount,
  filteredAlumnos,
  handleNavigation,
  handleAIAnalysis,
  searchQuery,
  setSearchQuery,
  expandedAlumnoId,
  setExpandedAlumnoId,
  asistenciasHoy,
  pagosHoy,
  togglePayment,
  toggleAttendance,
  asistenciasClase,
  isLoadingAsistenciasClase,
  handleDeleteAsistencia,
  handleEditAsistencia,
  asistenciasGlobales,
  alumnos,
  grupos,
  isAnalyzing,
  comparativeData,
  handleExportAttendance,
  studentForm,
  setStudentForm,
  handleSaveStudent,
  isSavingStudent,
  isLoadingMonthly,
  monthlyStats,
  setReportMonth,
  setReportYear,
  clases,
  asistencias,
  selectedDisciplina,
  setSelectedDisciplina,
  planesFilterDate,
  setPlanesFilterDate,
  planesFilterCoach,
  setPlanesFilterCoach,
  handleExportGroupAttendance,
  handleExportAllAttendance,
  setSelectedAlumno
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  if (vista === 'RegistroAlumno' && activeGroup) {
    return (
      <div className="space-y-8 page-transition pb-12 px-6 pt-4 bg-ios-gray min-h-screen">
        <header className="flex items-center gap-4">
          <button onClick={() => setVista('AsistenciaLista')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary border border-black/5 active:scale-90 transition-all">
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-black font-bold text-xl tracking-tight uppercase leading-none">Nueva Inscripción</h2>
            <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Grupo: {activeGroup.nombre}</p>
          </div>
        </header>
        <div className="bg-white rounded-[2.5rem] p-8 shadow-ios space-y-8 border border-black/5">
          <div className="space-y-4">
            <h4 className="text-secondary font-bold text-[10px] border-b border-black/5 pb-2 uppercase tracking-[0.2em]">Identificación</h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-secondary ml-1">Nombre y Apellido *</label>
                <input className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Nombre completo..." value={studentForm.nombre || ''} onChange={(e) => setStudentForm({...studentForm, nombre: e.target.value})}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">DNI (Opcional)</label>
                  <input className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Número..." value={studentForm.dni || ''} onChange={(e) => setStudentForm({...studentForm, dni: e.target.value})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Fecha Nacimiento *</label>
                  <input type="date" className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" value={studentForm.fechaNacimiento || ''} onChange={(e) => setStudentForm({...studentForm, fechaNacimiento: e.target.value})}/>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-secondary font-bold text-[10px] border-b border-black/5 pb-2 uppercase tracking-[0.2em]">Contactos de Familia</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Nombre del Padre</label>
                  <input className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Nombre..." value={studentForm.contacto?.padreNombre || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), padreNombre: e.target.value}})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Teléfono Padre</label>
                  <input type="tel" className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Número..." value={studentForm.contacto?.padreTelefono || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), padreTelefono: e.target.value}})}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Nombre de la Madre</label>
                  <input className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Nombre..." value={studentForm.contacto?.madreNombre || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), madreNombre: e.target.value}})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Teléfono Madre</label>
                  <input type="tel" className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Número..." value={studentForm.contacto?.madreTelefono || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), madreTelefono: e.target.value}})}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Contacto Emergencia</label>
                  <input className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Nombre..." value={studentForm.contacto?.emergenciaNombre || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), emergenciaNombre: e.target.value}})}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-secondary ml-1">Teléfono Emergencia</label>
                  <input type="tel" className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" placeholder="Número..." value={studentForm.contacto?.emergenciaTelefono || ''} onChange={(e) => setStudentForm({...studentForm, contacto: {...(studentForm.contacto || {}), emergenciaTelefono: e.target.value}})}/>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-secondary font-bold text-[10px] border-b border-black/5 pb-2 uppercase tracking-[0.2em]">Seguimiento Médico</h4>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-secondary ml-1">Observaciones de Salud (Opcional)</label>
              <textarea className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20 h-24" placeholder="Alergias, condiciones médicas..." value={studentForm.alertas?.[0] || ''} onChange={(e) => setStudentForm({...studentForm, alertas: [e.target.value]})}/>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-secondary ml-1">Fecha de Inicio de Actividades</label>
              <input type="date" className="w-full bg-ios-gray rounded-xl px-4 py-4 text-sm text-black outline-none focus:border-primary/20" value={studentForm.fechaPrimeraClase || ''} onChange={(e) => setStudentForm({...studentForm, fechaPrimeraClase: e.target.value})}/>
            </div>
          </div>
          <button 
            onClick={handleSaveStudent} 
            disabled={isSavingStudent}
            className="w-full py-5 rounded-3xl bg-ios-blue text-white font-bold uppercase tracking-[0.2em] text-sm shadow-ios active:scale-95 transition-all disabled:opacity-50"
          >
            {isSavingStudent ? 'Guardando...' : 'Finalizar Alta de Gimnasta'}
          </button>
        </div>
      </div>
    );
  }

  if (vista === 'ReportePDF' && activeGroup) {
    return (
      <div className="page-transition p-8 bg-white text-black min-h-screen">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <button onClick={() => setVista('AsistenciaLista')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all">
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-black">
              <select 
                value={reportMonth} 
                onChange={(e) => {
                  const m = parseInt(e.target.value);
                  setReportMonth(m);
                  loadMonthlyReport(activeGroup.nombre, m, reportYear);
                }}
                className="bg-transparent px-3 py-1.5 font-black text-xs uppercase outline-none"
              >
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                value={reportYear} 
                onChange={(e) => {
                  const y = parseInt(e.target.value);
                  setReportYear(y);
                  loadMonthlyReport(activeGroup.nombre, reportMonth, y);
                }}
                className="bg-transparent px-3 py-1.5 font-black text-xs uppercase outline-none border-l-2 border-black"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => window.print()}
              className="bg-black text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-icons-outlined text-sm">print</span> Imprimir
            </button>
          </div>
        </div>

        <div className="border-[6px] border-black p-10 max-w-5xl mx-auto space-y-12">
          <header className="flex justify-between items-start border-b-4 border-black pb-8">
            <div className="space-y-2">
              <h1 className="text-6xl font-black uppercase tracking-tighter leading-none">GymCoach Pro</h1>
              <h2 className="text-2xl font-black text-white/90 uppercase tracking-widest">Planilla Mensual</h2>
            </div>
            <div className="text-right space-y-1 font-black uppercase text-sm">
              <p>Grupo: <span className="bg-black text-white px-2 py-0.5">{activeGroup.nombre}</span></p>
              <p>Mes: <span className="bg-black text-white px-2 py-0.5">{['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][reportMonth]} {reportYear}</span></p>
            </div>
          </header>

          {isLoadingMonthly ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 font-black uppercase tracking-widest">Calculando Asistencias...</p>
            </div>
          ) : (
            <table className="w-full border-collapse border-4 border-black">
              <thead>
                <tr className="bg-slate-100 uppercase text-[12px] font-black border-b-4 border-black">
                  <th className="p-5 text-left border-r-4 border-black">Gimnasta</th>
                  <th className="p-5 text-center border-r-4 border-black">DNI</th>
                  <th className="p-5 text-center border-r-4 border-black">Asistencias</th>
                  <th className="p-5 text-center border-r-4 border-black">%</th>
                  <th className="p-5 text-right">Firma Tutor</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.filter(a => a.grupo === activeGroup.nombre).map(a => {
                  const stats = monthlyStats[a.id!] || { attended: 0, expected: 0 };
                  const percentage = stats.expected > 0 ? Math.round((stats.attended / stats.expected) * 100) : 0;
                  return (
                    <tr key={a.id} className="border-b-4 border-black font-bold">
                      <td className="p-5 border-r-4 border-black uppercase">{a.nombre}</td>
                      <td className="p-5 text-center border-r-4 border-black font-mono">{a.dni || '---'}</td>
                      <td className="p-5 text-center border-r-4 border-black font-black">
                        {stats.attended} / {stats.expected}
                      </td>
                      <td className="p-5 text-center border-r-4 border-black font-black">
                        {percentage}%
                      </td>
                      <td className="p-5 text-right w-48"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="grid grid-cols-2 gap-8 pt-12">
            <div className="border-t-4 border-black pt-4">
              <p className="text-xs font-black uppercase tracking-widest">Firma del Profesor</p>
              <p className="mt-2 font-bold">{activeGroup.entrenador || '____________________'}</p>
            </div>
            <div className="border-t-4 border-black pt-4 text-right">
              <p className="text-xs font-black uppercase tracking-widest">Fecha de Emisión</p>
              <p className="mt-2 font-bold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <button onClick={() => window.print()} className="w-full py-6 mt-12 bg-black text-white font-black uppercase tracking-[0.4em] rounded-2xl print:hidden shadow-2xl">
            Imprimir Documento
          </button>
        </div>
      </div>
    );
  }

  if (vista !== 'AsistenciaLista' || !activeGroup) return null;

  return (
    <div className="page-transition flex flex-col min-h-screen relative bg-ios-gray">
      <header className="px-6 py-4 flex flex-col gap-4 bg-ios-gray sticky top-12 z-40">
        <div className="flex items-center justify-between">
          <button onClick={() => setVista('Dashboard')} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-black/5 text-primary">
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>
          <h1 className="text-sm font-bold tracking-widest uppercase text-secondary">Asistencia</h1>
          <button 
            onClick={() => {
              loadMonthlyReport(activeGroup.nombre, reportMonth, reportYear);
              setVista('ReportePDF');
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-black/5 text-primary"
            title="Reporte Mensual"
          >
            <span className="material-icons-outlined text-[20px]">assessment</span>
          </button>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold text-black tracking-tight leading-none">{activeGroup.nombre}</h2>
              <button 
                onClick={() => {
                  setEditingGroup(activeGroup);
                  setNewGroupName(activeGroup.nombre);
                  setNewCoachName(activeGroup.entrenador || "");
                  setSelectedDays(activeGroup.dias || []);
                  const times = activeGroup.horario.split(' - ');
                  if (times.length === 2) {
                    setStartTime(times[0]);
                    setEndTime(times[1]);
                  }
                  setVista('Horario');
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 border border-black/5 text-secondary hover:text-primary transition-all"
                title="Editar Grupo"
              >
                <span className="material-icons-outlined text-[16px]">edit</span>
              </button>
            </div>
            <p className="text-primary font-medium flex items-center gap-2 mt-2 opacity-90 text-sm">
              <span className="material-symbols-outlined text-[18px]">schedule</span> {activeGroup.horario}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">Presentes</span>
            <div className="text-2xl font-bold text-primary">
              {presentCount}<span className="text-black/10 mx-1">/</span>{filteredAlumnos.length}
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-2 flex gap-3 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => handleNavigation('RegistroAlumno')}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-sm border border-black/5 text-primary text-[10px] font-bold uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
        >
          <span className="material-icons-outlined text-sm">person_add</span>
          Agregar Gimnasta
        </button>
        <button 
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-sm border border-black/5 text-ios-green text-[10px] font-bold uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
        >
          <span className="material-icons-outlined text-sm">receipt_long</span>
          Importar Pagos
        </button>

        <button 
          onClick={handleAIAnalysis}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-sm border border-black/5 text-ios-orange text-[10px] font-bold uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
        >
          <span className="material-icons-outlined text-sm">psychology</span>
          Asistente IA
        </button>
        <button 
          onClick={() => {
            const element = document.getElementById('recent-classes-section');
            element?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-sm border border-black/5 text-secondary text-[10px] font-bold uppercase tracking-widest whitespace-nowrap active:scale-95 transition-all"
        >
          <span className="material-icons-outlined text-sm">history</span>
          Clases Recientes
        </button>
      </div>

      <div className="px-6 pt-2 pb-4">
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-xl group-focus-within:text-primary transition-colors">search</span>
          <input 
            className="w-full bg-white border border-black/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-black outline-none focus:border-primary/20 shadow-sm transition-all"
            placeholder="Buscar gimnasta..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
        {filteredAlumnos.length > 0 ? filteredAlumnos.map(alumno => {
          const hasAlerts = alumno.alertas && alumno.alertas.length > 0 && alumno.alertas[0] !== '';
          const isExpanded = expandedAlumnoId === alumno.id;

          return (
            <div key={alumno.id} className={`flex flex-col p-4 rounded-3xl bg-white shadow-ios border border-black/5 transition-all duration-300 ${!asistenciasHoy[alumno.id!] ? 'opacity-50 grayscale select-none' : 'opacity-100'}`}>
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => setExpandedAlumnoId(isExpanded ? null : alumno.id!)}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-ios-gray flex items-center justify-center overflow-hidden border border-black/5">
                      <img 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(alumno.nombre)}&background=F2F2F7&color=1C1C1E&size=128`}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {asistenciasHoy[alumno.id!] && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-ios-green rounded-full border-2 border-white"></div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-black leading-none">{alumno.nombre}</h4>
                      {hasAlerts && (
                        <span className="material-icons-outlined text-ios-orange text-[16px] animate-pulse" title="Alerta Médica">warning</span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-secondary">{alumno.nivel}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">
                      PAGO {new Date().toLocaleString('es-ES', { month: 'short' }).toUpperCase()}
                    </span>
                    <button 
                      onClick={() => togglePayment(alumno.id!)}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${pagosHoy[alumno.id!] ? 'bg-ios-green border-transparent text-white' : 'bg-ios-gray border-black/5 text-transparent'}`}
                    >
                      <span className="material-icons-outlined text-[16px]">check</span>
                    </button>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={asistenciasHoy[alumno.id!] || false}
                      onChange={() => toggleAttendance(alumno.id!)}
                    />
                    <div className="w-11 h-6 bg-ios-gray peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ios-blue shadow-sm"></div>
                  </label>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-black/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  {hasAlerts && (
                    <div className="bg-ios-orange/5 border border-ios-orange/10 rounded-2xl p-4">
                      <h5 className="text-[10px] font-bold text-ios-orange uppercase tracking-widest mb-2 flex items-center gap-1">
                        <span className="material-icons-outlined text-[14px]">medical_services</span>
                        Observaciones de Salud
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {alumno.alertas.map((alerta, i) => (
                          <span key={i} className="text-[10px] text-black/70 bg-ios-gray px-3 py-1.5 rounded-full font-medium">{alerta}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setSelectedAlumno(alumno);
                        handleNavigation('AlumnoDetalle');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-ios-gray text-black text-[10px] font-bold uppercase tracking-widest hover:bg-black/5 transition-all"
                    >
                      <span className="material-icons-outlined text-sm">visibility</span>
                      Ver Perfil
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 glass-card rounded-[2.5rem] border-dashed border-white/10 mx-2">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/5 shadow-inner">
              <span className="material-icons-outlined text-white/10 text-4xl">group_add</span>
            </div>
            <div className="space-y-2 px-8">
              <h3 className="text-white font-black text-lg uppercase tracking-tight leading-tight">Este grupo está vacío</h3>
              <p className="text-white/40 text-xs leading-relaxed">No hay alumnas asignadas a <span className="text-primary font-bold">{activeGroup.nombre}</span> todavía.</p>
            </div>
            <button 
              onClick={() => handleNavigation('RegistroAlumno')}
              className="px-8 py-4 bg-primary text-antigravity-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-neon-cyan hover:scale-105 active:scale-95 transition-all"
            >
              Inscribir Alumnas
            </button>
          </div>
        )}

        <div id="recent-classes-section" className="pt-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-secondary uppercase tracking-widest">Historial de Clases</h3>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{asistenciasClase.length} Sesiones</span>
          </div>

          <div className="space-y-3">
            {isLoadingAsistenciasClase ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : asistenciasClase.length > 0 ? asistenciasClase.map((asistencia, idx) => (
              <div key={idx} className="bg-white p-4 rounded-3xl shadow-sm border border-black/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-ios-gray flex flex-col items-center justify-center border border-black/5">
                    <span className="text-[12px] font-bold text-black leading-none">{new Date(asistencia.fecha).getDate()}</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">{new Date(asistencia.fecha).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black leading-none">Clase de {new Date(asistencia.fecha).toLocaleDateString()}</h4>
                    <p className="text-[10px] text-secondary mt-1 uppercase font-bold tracking-widest">
                      {asistenciasGlobales[asistencia.fecha]?.presentes || 0} Presentes • {asistenciasGlobales[asistencia.fecha]?.total || 0} Total
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleEditAsistencia(asistencia)}
                    className="w-10 h-10 rounded-full bg-ios-gray flex items-center justify-center text-secondary hover:text-primary transition-all"
                  >
                    <span className="material-icons-outlined text-sm">edit</span>
                  </button>
                  <button 
                    onClick={() => handleDeleteAsistencia(asistencia)}
                    className="w-10 h-10 rounded-full bg-ios-red/10 flex items-center justify-center text-ios-red"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center bg-white rounded-[2.5rem] border border-dashed border-black/10 text-secondary text-[10px] font-bold uppercase tracking-widest">
                No hay registros de clases anteriores
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
