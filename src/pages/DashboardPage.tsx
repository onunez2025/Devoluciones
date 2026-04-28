// Build timestamp: 2026-04-28 11:54:00
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  RefreshCcw, 
  ChevronRight, 
  Calendar, 
  SearchX,
  History,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  TrendingUp,
  Download,
  Filter,
  DownloadCloud
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import Navbar from '../components/Navbar';
import NewDevolucionModal from '../components/NewDevolucionModal';
import DevolucionDetailModal from '../components/DevolucionDetailModal';
import apiClient from '../services/apiClient';
import { Devolucion } from '../types';

const DashboardPage = () => {
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDevolucion, setSelectedDevolucion] = useState<Devolucion | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Pagination & Search state
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [printData, setPrintData] = useState<{ id: string, url: string, nSerie?: string, nombre?: string } | null>(null);

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    noDiagnosis: 0,
    pending: 0,
    inProcess: 0,
    completed: 0,
    rejected: 0
  });

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/devoluciones/stats');
      setStats(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Error al cargar stats:', error);
    }
  };

  const fetchDevoluciones = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/devoluciones', {
        params: {
          page,
          limit,
          search: debouncedSearch
        }
      });
      setDevoluciones(response.data.data);
      setTotalRecords(response.data.pagination.total);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Error al cargar devoluciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchDevoluciones();
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchStats();
  }, []);


  const downloadAsImage = (id: string) => {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `etiqueta-${id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };


  const metrics = [
    { label: 'Total', value: stats.total, icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Hoy', value: stats.today, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Pendientes', value: stats.pending || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'En Proceso', value: stats.inProcess || 0, icon: RefreshCcw, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Completados', value: stats.completed || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
    { label: 'Rechazados', value: stats.rejected || 0, icon: Ban, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Sin Diagnóstico', value: stats.noDiagnosis, icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-lato">
      <Navbar />
      
      <main className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-700">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground leading-none">
              Control de Devoluciones
            </h1>
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronización en tiempo real activa
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="h-10 px-4 bg-muted/50 border border-border/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-muted transition-all flex items-center gap-2">
              <Download className="w-3.5 h-3.5" />
              Exportar Reporte
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="h-10 px-6 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Devolución
            </button>
          </div>
        </div>

        {/* Metrics High-Density Grid */}
        <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-7 gap-3">
          {metrics.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex flex-col gap-3 group hover:border-primary/20 transition-all cursor-default"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon size={16} />
                </div>
                <span className="text-[9px] font-black tracking-widest text-muted-foreground/30 uppercase">LIVE</span>
              </div>
              <div>
                <p className="text-[20px] font-black text-foreground leading-none tracking-tighter">
                  {stat.value}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mt-1 tracking-tight">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Unified Filter Bar */}
        <div className="glass-card p-2 flex flex-wrap gap-2 items-center bg-muted/10">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input 
              type="text"
              placeholder="Buscar por Ticket, Serie, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-10 h-10 text-[11px] font-bold border-transparent focus:border-primary/20"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="h-10 flex items-center px-3 bg-muted/40 rounded-xl border border-border/50">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground/60 mr-2" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground/80">Últimos 30 días</span>
            </div>
            
            <button className="h-10 w-10 flex items-center justify-center bg-muted/40 border border-border/50 rounded-xl hover:bg-muted transition-all">
              <Filter className="w-4 h-4 text-muted-foreground/60" />
            </button>

            <button 
              onClick={() => {
                fetchDevoluciones();
                fetchStats();
              }}
              className="h-10 px-4 flex items-center gap-2 bg-primary/5 border border-primary/10 text-primary rounded-xl hover:bg-primary/10 transition-all"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-widest px-1">Actualizar</span>
            </button>
          </div>
        </div>

        {/* High-Density Table / Mobile Cards */}
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block glass-card overflow-hidden shadow-premium border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/[0.02] border-b border-border/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">ID TICKET</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">EQUIPO / SERIE</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">GUÍA REMISIÓN</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">FECHA INGRESO</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">ESTADO SAP</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground opacity-60">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  <AnimatePresence mode="popLayout">
                    {devoluciones.map((dev, idx) => (
                      <motion.tr 
                        key={`${dev.Ticket}-${idx}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                        className="group hover:bg-primary/[0.02] transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedDevolucion(dev);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[12px] font-black text-foreground tracking-tight">#{dev.Ticket}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-foreground uppercase">{dev.IdEquipo}</span>
                            <span className="text-[9px] font-bold text-muted-foreground/60 font-mono">{dev.N_Serie || 'S/N Registrada'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-[10px] font-bold text-muted-foreground/80 px-2 py-1 bg-muted/50 rounded-lg border border-border/30">
                            {dev.N_Guia || 'SIN GUÍA'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2 text-muted-foreground/70">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase transition-colors group-hover:text-foreground">
                              {new Date(dev.FechaRegistro).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/10">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Validado</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link 
                              to={`/public/equipment/${dev.IdEquipo}`}
                              className="p-2 hover:bg-primary/10 text-muted-foreground/40 hover:text-primary rounded-xl transition-all"
                              title="Historial"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <History size={14} strokeWidth={2.5} />
                            </Link>
                             <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const publicUrl = `https://${window.location.host}/public/equipment/${dev.IdEquipo}`;
                                setPrintData({ id: dev.IdEquipo || '', url: publicUrl, nSerie: dev.N_Serie });
                                setTimeout(() => downloadAsImage(dev.IdEquipo || ''), 500);
                              }}
                              className="px-3 py-1.5 bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white rounded-lg transition-all flex items-center gap-2 border border-orange-500/20 shadow-sm"
                              title="Descargar para ZLabel Designer"
                            >
                              <DownloadCloud size={13} strokeWidth={2.5} />
                              <span className="text-[10px] font-black uppercase tracking-tighter">ZLabel</span>
                            </button>
                            <button 
                              className="p-2 hover:bg-muted text-muted-foreground/40 hover:text-foreground rounded-xl transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDevolucion(dev);
                                setIsDetailModalOpen(true);
                              }}
                            >
                              <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            <AnimatePresence mode="popLayout">
              {devoluciones.map((dev, idx) => (
                <motion.div
                  key={`${dev.Ticket}-card-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  className="glass-card p-4 space-y-4 active:scale-[0.98] transition-all"
                  onClick={() => {
                    setSelectedDevolucion(dev);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[14px] font-black text-foreground">Ticket #{dev.Ticket}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 text-[9px] font-black uppercase">
                      Validado
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Equipo / Serie</p>
                      <p className="text-[11px] font-bold text-foreground uppercase">{dev.IdEquipo}</p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 font-mono truncate">{dev.N_Serie || 'S/N Registrada'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-muted-foreground/40">Guía Remisión</p>
                      <p className="text-[11px] font-bold text-foreground">{dev.N_Guia || 'SIN GUÍA'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground/60">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase">
                        {new Date(dev.FechaRegistro).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link 
                        to={`/public/equipment/${dev.IdEquipo}`}
                        className="p-2 bg-primary/5 text-primary rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <History size={14} />
                      </Link>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const publicUrl = `https://${window.location.host}/public/equipment/${dev.IdEquipo}`;
                          setPrintData({ id: dev.IdEquipo || '', url: publicUrl, nSerie: dev.N_Serie });
                          setTimeout(() => downloadAsImage(dev.IdEquipo || ''), 500);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-black text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all uppercase"
                      >
                        <DownloadCloud size={16} />
                        Descargar Etiqueta (ZLabel)
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {devoluciones.length === 0 && !loading && (
            <div className="py-24 glass-card border-white/5">
              <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="p-6 bg-muted/20 rounded-full">
                  <SearchX size={40} className="text-muted-foreground/20" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-black uppercase tracking-widest text-muted-foreground/40">Sin resultados</p>
                  <p className="text-[10px] font-bold text-muted-foreground/20 mt-1 italic">Intente cambiar los filtros de búsqueda</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Professional */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Mostrando <span className="text-foreground">{devoluciones.length}</span> de <span className="text-foreground">{totalRecords}</span> ingresos
            </p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="h-9 px-4 bg-muted/30 border border-border/50 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-muted disabled:opacity-20"
              >
                Anterior
              </button>
              <div className="h-9 px-4 flex items-center bg-primary/5 border border-primary/10 rounded-xl text-[10px] font-black text-primary">
                {page} / {totalPages}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="h-9 px-4 bg-muted/30 border border-border/50 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-muted disabled:opacity-20"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <NewDevolucionModal 
            onClose={() => setIsModalOpen(false)} 
            onSuccess={() => {
              fetchDevoluciones();
              fetchStats();
            }} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedDevolucion && (
          <DevolucionDetailModal 
            devolucion={selectedDevolucion}
            onClose={() => setIsDetailModalOpen(false)}
          />
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
            {printData.nSerie && (
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                SERIE: {printData.nSerie}
              </div>
            )}
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
              {printData.nSerie && (
                <div style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '10px' }}>
                  SERIE: {printData.nSerie}
                </div>
              )}
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Sole - MT Industrial</div>
              <div style={{ fontSize: '20px', color: '#666' }}>HISTORIAL ONLINE</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
