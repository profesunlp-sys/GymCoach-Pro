import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/90 backdrop-blur-xl text-[10px] font-bold uppercase tracking-widest text-white rounded-2xl pointer-events-none whitespace-nowrap z-[100] shadow-2xl flex items-center gap-2 border border-white/10"
          >
            <div className="w-1.5 h-1.5 bg-ios-blue rounded-full animate-pulse shadow-ios"></div>
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  type = 'button',
  title = ''
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning',
  className?: string,
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset',
  title?: string
}) => {
  const variants = {
    primary: 'bg-ios-blue text-white shadow-lg active:scale-95',
    secondary: 'bg-ios-gray text-secondary border border-black/5 hover:bg-black/5 active:scale-95',
    outline: 'bg-transparent text-ios-blue border border-ios-blue/30 hover:bg-ios-blue/5 active:scale-95',
    ghost: 'bg-transparent text-secondary hover:text-black hover:bg-ios-gray active:scale-95',
    danger: 'bg-ios-red/10 text-ios-red border border-ios-red/10 hover:bg-ios-red/20 active:scale-95',
    success: 'bg-ios-green/10 text-ios-green border border-ios-green/10 hover:bg-ios-green/20 active:scale-95',
    warning: 'bg-ios-orange/10 text-ios-orange border border-ios-orange/10 hover:bg-ios-orange/20 active:scale-95'
  };

  const content = (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-4 rounded-[1.2rem] font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );

  if (title) {
    return <Tooltip text={title}>{content}</Tooltip>;
  }

  return content;
};

// BackButton mejorado: fixed, con fondo blanco/desenfoque y sombra para evitar superposición
export const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="fixed top-8 left-6 z-50 flex items-center gap-2 text-secondary hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest active:scale-95 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-black/5"
  >
    <span className="material-icons-outlined text-base">arrow_back</span>
    Volver
  </button>
);

export const EditableDropdown = ({ 
  label, 
  value, 
  onChange, 
  options, 
  onAdd, 
  onEdit,
  onDelete, 
  placeholder 
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  options: any[], 
  onAdd: (name: string) => void, 
  onEdit: (id: string, name: string) => void,
  onDelete: (id: string) => void,
  placeholder: string
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState('');

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] uppercase font-bold text-secondary ml-1 tracking-widest leading-none">{label}</label>
      <div className="relative group">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-ios-gray border-none rounded-2xl pl-4 pr-24 py-4 text-sm font-medium text-black appearance-none outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all overflow-hidden text-ellipsis text-left cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((opt, idx) => (
            <option key={opt.id || idx} value={opt.nombre}>
              {opt.nombre} {opt.entrenador ? `— ${opt.entrenador}` : ''}
            </option>
          ))}
        </select>
        
        {/* Control Icons */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            {value && (
              <div className="flex items-center gap-0.5 mr-1 pr-1 border-r border-black/5">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const opt = options.find(o => o.nombre === value);
                    if (opt?.id) {
                      const newName = window.prompt(`Editar ${label.toLowerCase()}:`, opt.nombre);
                      if (newName && newName.trim() && newName !== opt.nombre) {
                        onEdit(opt.id, newName.trim());
                        onChange(newName.trim());
                      }
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center text-secondary/60 hover:text-ios-blue hover:bg-ios-blue/10 rounded-xl transition-all active:scale-90"
                >
                  <span className="material-icons-outlined text-base">edit</span>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const opt = options.find(o => o.nombre === value);
                    if (opt?.id) {
                      if (window.confirm(`¿Seguro que deseas eliminar "${opt.nombre}"?`)) {
                        onDelete(opt.id);
                        onChange('');
                      }
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center text-ios-red/60 hover:text-ios-red hover:bg-ios-red/10 rounded-xl transition-all active:scale-90"
                >
                  <span className="material-icons-outlined text-base">delete</span>
                </button>
              </div>
            )}
            <button 
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90 shadow-sm ${isAdding ? 'bg-white text-ios-red border border-ios-red/20' : 'bg-ios-blue text-white shadow-ios'}`}
            >
              <span className="material-icons-outlined text-base">{isAdding ? 'close' : 'add'}</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="absolute left-0 right-0 z-50 mt-2 p-6 bg-white border border-black/5 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-ios-blue ml-1 tracking-widest">Nuevo {label}</label>
                <input 
                  type="text" 
                  value={newItem} 
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Escribir nombre..."
                  autoFocus
                  className="w-full bg-ios-gray border-none rounded-xl px-4 py-4 text-sm text-black font-medium outline-none focus:ring-2 focus:ring-ios-blue/10 transition-all font-medium"
                />
              </div>
              <Button 
                onClick={() => {
                  if (newItem.trim()) {
                    onAdd(newItem.trim());
                    onChange(newItem.trim());
                    setNewItem('');
                    setIsAdding(false);
                  }
                }}
                className="w-full !rounded-2xl"
              >
                Guardar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};