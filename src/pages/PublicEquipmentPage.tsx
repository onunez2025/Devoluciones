import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  FileText, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  Package,
  Calendar,
  Cpu,
  ArrowLeft,
  X,
  User,
  Wrench,
  Info,
  Clock,
  DownloadCloud
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import apiClient from '../services/apiClient';
import { TechnicalReport } from '../types';

const PublicEquipmentPage = () => {
  const { idEquipo } = useParams();
  const [history, setHistory] = useState<TechnicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState<TechnicalReport | null>(null);

  const [equipmentInfo, setEquipmentInfo] = useState({ id: '', nombre: 'Cargando...', codigo: '' });
  const [printData, setPrintData] = useState<{ id: string, url: string } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      console.log(`📡 Solicitando historial para: ${idEquipo}...`);
      try {
        const response = await apiClient.get(`/public/equipment/${idEquipo}/history`);
        console.log('📜 Historial recibido:', response.data);
        setHistory(response.data);
        
        if (response.data.length > 0) {
          const first = response.data[0];
          setEquipmentInfo({
            id: first.IdEquipo || idEquipo || '',
            nombre: first.NombreEquipo || 'Equipo en Sistema',
            codigo: first.CodigoExternoEquipo || idEquipo || '',
          });
        } else {
           setEquipmentInfo(prev => ({ ...prev, nombre: 'Sin historial reciente' }));
        }
      } catch (err: any) {
        console.error('❌ Error al cargar historial:', err);
        setError('No se pudo cargar el historial del equipo.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [idEquipo]);

  const openPdf = (ticket: string) => {
    // Abrimos directamente el endpoint que ahora hace proxy del PDF
    window.open(`/api/c4c/pdf/${ticket}`, '_blank');
  };


  const downloadAsImage = () => {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `etiqueta-${idEquipo}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };


  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Navigation & Title */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => window.history.back()}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors flex items-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Atrás</span>
          </button>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setPrintData({ id: idEquipo || '', url: window.location.href });
                setTimeout(downloadAsImage, 500);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/30 active:scale-95"
              title="Descargar Imagen para ZLabel Designer"
            >
              <DownloadCloud size={16} />
              Imprimir Etiqueta (ZLabel)
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Consulta Pública</span>
            </div>
          </div>
        </div>

        {/* Equipment Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden border-primary/10"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 relative">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/10 shadow-2xl shrink-0">
              <Package size={64} className="text-primary animate-pulse" />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-md uppercase tracking-wider border border-primary/30">
                  Equipo Activo
                </span>
                <span className="text-muted-foreground text-[10px] uppercase font-medium tracking-widest">
                  ID: {equipmentInfo.id}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {equipmentInfo.nombre}
              </h1>
              <p className="text-muted-foreground text-sm font-medium flex items-center justify-center md:justify-start gap-2">
                <Cpu size={14} className="text-primary" />
                SKU: <span className="text-foreground">{equipmentInfo.codigo}</span>
              </p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-primary rounded-full" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-foreground font-bold uppercase text-xs tracking-widest animate-pulse">Sincronizando con SAP C4C</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        ) : error ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-10 border-destructive/20 flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-2">
              <AlertCircle className="text-destructive w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">Error de Conexión</h3>
              <p className="text-muted-foreground text-sm mt-1">{error}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-6 h-10 bg-muted hover:bg-border rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all"
            >
              Reintentar Consulta
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">
                Informes Técnicos Cerrados ({history.length})
              </span>
              <div className="h-px w-full bg-gradient-to-r from-border to-transparent" />
            </div>

            {history.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-16 text-center"
              >
                <div className="w-20 h-20 bg-muted/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/50">
                  <History size={40} className="text-muted-foreground/20" />
                </div>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">Sin Historial Técnico</h3>
                <p className="text-muted-foreground text-sm mt-1">No se encontraron registros de reparaciones o diagnósticos finalizados.</p>
              </motion.div>
            ) : (
              <div className="relative space-y-4">
                {/* Timeline Line */}
                <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent hidden sm:block" />

                {history.map((report, idx) => (
                  <motion.div 
                    key={report.Id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative pl-0 sm:pl-16 group"
                  >
                    {/* Timeline Dot */}
                    <div className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] hidden sm:block z-10 transition-transform group-hover:scale-125" />

                    <div className="glass-card p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-glow hover:border-primary/20 transition-all group-active:scale-[0.99]">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors border border-border group-hover:border-primary/20">
                          <FileText size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-foreground font-black text-sm tracking-tight uppercase">Ticket #{report.Ticket}</span>
                            <div className="px-2 py-0.5 bg-green-500/10 rounded text-[9px] text-green-500 font-black uppercase tracking-tighter">
                              Cerrado
                            </div>
                            {report.TipoServicio && (
                              <div className="px-2 py-0.5 bg-blue-500/10 rounded text-[9px] text-blue-500 font-black uppercase tracking-tighter">
                                {report.TipoServicio}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium uppercase tracking-tighter">
                            <span className="flex items-center gap-1.5 translate-y-[-1px]">
                              <Calendar size={12} className="text-primary/50" />
                              {new Date(report.FechaCierre).toLocaleDateString('es-PE', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: '2-digit' 
                              })}
                            </span>
                            <span className="w-1 h-1 bg-border rounded-full" />
                            <span className="flex items-center gap-1.5">
                              ID: {report.Id}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setSelectedReport(report)}
                        className="w-full md:w-auto h-10 px-6 bg-muted hover:bg-primary text-foreground hover:text-white rounded-lg flex items-center justify-center gap-2 transition-all text-[11px] font-black uppercase tracking-[0.1em] border border-border hover:border-primary shadow-sm"
                      >
                        Detalle Técnico
                        <Info size={14} className="opacity-50" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-12 pb-6 border-t border-border/10">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 opacity-30 grayscale saturate-0">
               <div className="text-[10px] font-black tracking-widest">SAP C4C INTEGRATION</div>
               <div className="w-px h-3 bg-foreground" />
               <div className="text-[10px] font-black tracking-widest">MT INDUSTRIAL</div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 text-center">
              MT Industrial S.A.C • División de Garantía y Servicio Técnico
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-card overflow-hidden shadow-2xl border-primary/20"
            >
              {/* Header Modal */}
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Informe Técnico Digital</span>
                    <div className="w-1 h-1 bg-border rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket #{selectedReport.Ticket}</span>
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-foreground uppercase">
                    {selectedReport.Asunto || 'Mantenimiento de Equipo'}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content Modal */}
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8 custom-scrollbar">
                
                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-2 mb-2 opacity-50">
                      <Calendar size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Fecha de Visita</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {new Date(selectedReport.FechaCierre).toLocaleDateString('es-PE', { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-2 mb-2 opacity-50">
                      <User size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Técnico Asignado</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{selectedReport.Tecnico || 'No especificado'}</p>
                  </div>
                </div>

                {/* Cliente y Producto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-2 opacity-50 text-primary">
                      <User size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Cliente</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{selectedReport.NombreCliente || 'No especificado'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-2 opacity-50 text-blue-500">
                      <Package size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Producto / Equipo</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{selectedReport.NombreEquipo || 'No especificado'}</p>
                  </div>
                </div>

                {/* Tipo de Servicio (Si existe) */}
                {selectedReport.TipoServicio && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2 opacity-50 text-blue-500">
                      <Wrench size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Tipo de Servicio</span>
                    </div>
                    <p className="text-sm font-black text-blue-600 uppercase tracking-tight">{selectedReport.TipoServicio}</p>
                  </div>
                )}

                {/* Trabajo Realizado Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Info size={16} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Estado de la Visita</h3>
                  </div>
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 leading-relaxed text-sm text-foreground/90 font-medium flex items-center gap-3">
                    {selectedReport.TrabajoRealizado === 'true' || selectedReport.TrabajoRealizado === 'Yes' ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Trabajo Realizado con Éxito</span>
                      </>
                    ) : selectedReport.TrabajoRealizado === 'false' || selectedReport.TrabajoRealizado === 'No' ? (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span>Visita Realizada (Sin intervención técnica)</span>
                      </>
                    ) : (
                      <span>{selectedReport.TrabajoRealizado || 'Sin detalles registrados'}</span>
                    )}
                  </div>
                </div>

                {/* Comentarios Adicionales */}
                {selectedReport.ComentarioTecnico && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText size={16} />
                      <h3 className="text-xs font-black uppercase tracking-widest">Comentarios del Técnico</h3>
                    </div>
                    <p className="text-sm text-muted-foreground italic pl-4 border-l-2 border-border/50">
                      "{selectedReport.ComentarioTecnico}"
                    </p>
                  </div>
                )}

                {/* Estado Siguiente */}
                <div className="p-4 rounded-xl border border-dashed border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selectedReport.SolicitaNuevaVisita === 'Yes' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-tighter opacity-50">Requerimiento Posterior</p>
                      <p className="text-sm font-bold">
                        {selectedReport.SolicitaNuevaVisita === 'Yes' 
                          ? `Nueva visita solicitada: ${selectedReport.MotivoNuevaVisita || 'Pendiente'}`
                          : 'No requiere seguimiento inmediato'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-6 border-t border-border/50 bg-muted/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <button 
                  onClick={() => openPdf(selectedReport.Ticket)}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink size={14} />
                  Intentar abrir informe SAP original
                </button>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="w-full sm:w-auto px-8 py-3 bg-foreground text-background rounded-xl font-black uppercase text-[11px] tracking-widest hover:opacity-90 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vista de Impresión Oculta (3x2 pulgadas) */}
      {printData && (
        <div id="print-label" style={{ display: 'none' }}>
          <div style={{ marginRight: '6mm' }}>
            <QRCodeSVG value={printData.url} size={140} level="H" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', borderBottom: '2px solid black', marginBottom: '6px', paddingBottom: '2px' }}>
              #{printData.id}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', marginTop: '4px', textTransform: 'uppercase' }}>
              Sole - MT Industrial
            </div>
            <div style={{ fontSize: '8px', color: '#444', marginTop: '2px', fontWeight: 'bold' }}>
              HISTORIAL TÉCNICO ONLINE
            </div>
          </div>
        </div>
      )}

      {/* Canvas oculto para generación de imagen */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {printData && (
          <div id="capture-area" style={{ 
            width: '600px', 
            height: '400px', 
            background: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '40px',
            color: 'black'
          }}>
            <QRCodeCanvas 
              id="qr-canvas"
              value={printData.url} 
              size={320} 
              level="H"
              includeMargin={true}
            />
            <div style={{ marginLeft: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: 'Arial' }}>
              <div style={{ fontSize: '60px', fontWeight: 'bold', borderBottom: '5px solid black', marginBottom: '20px' }}>
                #{printData.id}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Sole - MT Industrial</div>
              <div style={{ fontSize: '20px', color: '#666' }}>HISTORIAL ONLINE</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEquipmentPage;
