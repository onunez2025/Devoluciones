import { motion } from 'motion/react';
import { X, Calendar, Package, ClipboardList, Tag, FileText, Camera, Printer, RefreshCcw, User, Wrench, ExternalLink } from 'lucide-react';
import { Devolucion } from '../types';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { generateZPL } from '../services/zplService';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../utils/siatc-theme';
import { cn } from '../utils/cn';
import { openAuthenticatedFile } from '../utils/openAuthenticatedFile';

interface Props {
  devolucion: Devolucion;
  onClose: () => void;
}

const DevolucionDetailModal = ({ devolucion, onClose }: Props) => {
  const { t } = useTranslation();
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
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs md:bg-background/80 md:backdrop-blur-sm touch-none animate-in fade-in duration-300"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "fixed bottom-0 inset-x-0 max-h-[85dvh] rounded-t-cb-modal animate-in slide-in-from-bottom duration-300",
          "md:relative md:bottom-auto md:inset-x-auto md:w-full md:max-w-3xl md:max-h-[92vh] md:rounded-cb-modal md:[--tw-enter-translate-y:0] md:zoom-in-95",
          "bg-card text-cb-text-primary border border-cb-border shadow-cb-level-3 overflow-hidden flex flex-col"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-cb-border bg-cb-bg/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 bg-primary/10 text-primary", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-foreground">
                {t('devolucion.detail.title')}
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/60">
                Ticket #{devolucion.Ticket}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all group"
          >
            <X className="w-5 h-5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>

        <div className="p-4 md:p-8 overflow-y-auto space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Info Section */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{t('devolucion.detail.infoSection')}</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                  <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                    <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.registryDate')}</p>
                      <p className="text-xs font-bold text-foreground">
                        {new Date(devolucion.FechaRegistro).toLocaleDateString('es-PE', {
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                    <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                      <Package size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.idEquipo')}</p>
                      <p className="text-xs font-black text-primary">{devolucion.IdEquipo || t('common.na')}</p>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                    <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                      <Tag size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.serial')}</p>
                      <p className="text-xs font-bold text-foreground">{devolucion.N_Serie || t('devolucion.detail.noSerial')}</p>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                    <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.guide')}</p>
                      <p className="text-xs font-bold text-foreground">{devolucion.N_Guia || t('common.na')}</p>
                    </div>
                  </div>

                  {devolucion.NombreCliente && (
                    <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                      <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.client')}</p>
                        <p className="text-xs font-bold text-foreground">{devolucion.NombreCliente}</p>
                      </div>
                    </div>
                  )}

                  {devolucion.NombreEquipo && (
                    <div className={cn("flex items-center gap-4 bg-muted/20 md:bg-transparent p-3 md:p-0", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                      <div className={cn("w-10 h-10 bg-muted/50 flex items-center justify-center text-muted-foreground/40 shrink-0", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
                        <Wrench size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground/40">{t('devolucion.detail.product')}</p>
                        <p className="text-xs font-bold text-foreground">{devolucion.NombreEquipo}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{t('devolucion.detail.observations')}</h4>
                <div className={cn("p-4 bg-muted/30 border border-border/50", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                  <p className="text-[11px] leading-relaxed font-medium text-foreground/80 italic">
                    "{devolucion.Comentario || t('devolucion.detail.noObservations')}"
                  </p>
                </div>
              </div>

              {devolucion.ComentarioTecnico && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{t('devolucion.detail.techComment')}</h4>
                  <div className={cn("p-4 bg-muted/30 border border-border/50", SIATC_THEME.TOKENS.RADIUS.CARD)}>
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
                <Camera size={12} className="text-primary" /> {t('devolucion.detail.photo')}
              </h4>

              <div className={cn("relative aspect-video md:aspect-square overflow-hidden bg-muted/50 border border-border/50 group", SIATC_THEME.TOKENS.RADIUS.MODAL)}>
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t('devolucion.detail.noPhoto')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 bg-muted/20 border-t border-border flex flex-col md:flex-row gap-3 justify-stretch md:justify-end">
          <button
            onClick={() => openAuthenticatedFile(`/c4c/pdf/${devolucion.Ticket}`).catch((err) => {
              console.error('Error al abrir reporte SAP:', err);
              alert('No se pudo abrir el reporte SAP. Intenta nuevamente.');
            })}
            className={cn(
              "flex-1 md:flex-none px-6 h-12 md:h-10 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2",
              SIATC_THEME.TOKENS.RADIUS.BUTTON
            )}
          >
            <ExternalLink className="w-4 h-4" />
            {t('devolucion.detail.sapReport')}
          </button>

          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className={cn(
              "flex-1 md:flex-none px-6 h-12 md:h-10 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50",
              SIATC_THEME.TOKENS.RADIUS.BUTTON
            )}
          >
            {isPrinting ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {t(isPrinting ? 'devolucion.detail.printing' : 'devolucion.detail.printLabel')}
          </button>

          <button
            onClick={onClose}
            className={cn(
              "flex-1 md:flex-none px-8 h-12 md:h-10 bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg",
              SIATC_THEME.TOKENS.RADIUS.BUTTON
            )}
          >
            {t('devolucion.detail.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DevolucionDetailModal;
