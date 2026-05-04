import { motion } from 'framer-motion';
import { X, Calendar, Package, ClipboardList, Tag, FileText, Camera, Printer, RefreshCcw, User, Wrench, ExternalLink } from 'lucide-react';
import { Devolucion } from '../types';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { generateZPL } from '../services/zplService';
import { useState } from 'react';

interface Props {
  devolucion: Devolucion;
  onClose: () => void;
}

const DevolucionDetailModal = ({ devolucion, onClose }: Props) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!bluetoothPrinter.isSupported()) {
      alert('Tu navegador no soporta impresión Bluetooth. Intenta con Chrome.');
      return;
    }

    setIsPrinting(true);
    try {
      const zpl = generateZPL(devolucion);
      await bluetoothPrinter.print(zpl);
    } catch (error: any) {
      console.error('Error al imprimir:', error);
      alert(`Error al imprimir: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border-white/10"
      >
        {/* Header */}
        <div className="glass-card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-foreground">
                Detalle de Devolución
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/60">
                Ticket #{devolucion.Ticket}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all group"
          >
            <X className="w-5 h-5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>

        <div className="p-4 md:p-8 overflow-y-auto space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Info Section */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Información General</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                  <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Fecha de Registro</p>
                      <p className="text-xs font-bold text-foreground">
                        {new Date(devolucion.FechaRegistro).toLocaleDateString('es-PE', { 
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                      <Package size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">ID Equipo (FSM)</p>
                      <p className="text-xs font-black text-primary">{devolucion.IdEquipo || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                      <Tag size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Número de Serie</p>
                      <p className="text-xs font-bold text-foreground">{devolucion.N_Serie || 'Sin registro'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Guía de Remisión</p>
                      <p className="text-xs font-bold text-foreground">{devolucion.N_Guia || 'N/A'}</p>
                    </div>
                  </div>

                  {devolucion.NombreCliente && (
                    <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground/40">Cliente</p>
                        <p className="text-xs font-bold text-foreground">{devolucion.NombreCliente}</p>
                      </div>
                    </div>
                  )}

                  {devolucion.NombreEquipo && (
                    <div className="flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0">
                        <Wrench size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground/40">Producto</p>
                        <p className="text-xs font-bold text-foreground">{devolucion.NombreEquipo}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Observaciones</h4>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                  <p className="text-[11px] leading-relaxed font-medium text-foreground/80 italic">
                    "{devolucion.Comentario || 'Sin observaciones adicionales'}"
                  </p>
                </div>
              </div>

              {devolucion.ComentarioTecnico && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Comentario del Técnico</h4>
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <p className="text-[11px] leading-relaxed font-medium text-foreground/80 italic">
                      "{devolucion.ComentarioTecnico}"
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Image Section */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 flex items-center gap-2">
                <Camera size={12} className="text-primary" /> Evidencia Fotográfica
              </h4>
              
              <div className="relative aspect-video md:aspect-square rounded-3xl overflow-hidden bg-muted/50 border border-border/50 group">
                {devolucion.Adjunto && (devolucion.Adjunto.startsWith('http') || devolucion.Adjunto.startsWith('blob')) ? (
                  <img 
                    src={devolucion.Adjunto} 
                    alt="Evidencia" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground/20">
                      <Camera size={32} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Sin evidencia visual</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 bg-muted/20 border-t border-border flex flex-col md:flex-row gap-3 justify-stretch md:justify-end">
          <button 
            onClick={() => window.open(`/api/c4c/pdf/${devolucion.Ticket}`, '_blank')}
            className="flex-1 md:flex-none px-6 h-12 md:h-10 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Informe Técnico
          </button>

          <button 
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 md:flex-none px-6 h-12 md:h-10 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPrinting ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {isPrinting ? 'Imprimiendo...' : 'Imprimir Etiqueta'}
          </button>
          
          <button 
            onClick={onClose} 
            className="flex-1 md:flex-none px-8 h-12 md:h-10 bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Cerrar Detalle
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DevolucionDetailModal;
