import { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Search, 
  RefreshCcw, 
  Edit2, 
  Trash2, 
  SearchX,
  ChevronRight,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import apiClient from '../services/apiClient';

interface Role {
  Id: number;
  Nombre: string;
  Descripcion: string;
  Permisos?: string[];
}

const RolesPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error al cargar roles:', error);
      // Fallback para demostración
      setRoles([
        { Id: 1, Nombre: 'Administrador', Descripcion: 'Acceso total al sistema y gestión de usuarios.' },
        { Id: 2, Nombre: 'Supervisor', Descripcion: 'Puede ver todas las devoluciones y generar reportes.' },
        { Id: 3, Nombre: 'Técnico', Descripcion: 'Registro de devoluciones y diagnósticos de equipos.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const filteredRoles = roles.filter(role => 
    role.Nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.Descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Settings size={18} />
              <span className="text-[10px] font-black tracking-[0.2em] uppercase">Configuración de Seguridad</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Roles y Permisos</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Control granular de capacidades del sistema</p>
          </div>
          
          <button className="btn-primary h-11 px-6 shadow-glow">
            <Plus size={18} />
            <span className="text-[11px] font-black uppercase tracking-widest">Nuevo Perfil</span>
          </button>
        </header>

        {/* Filters */}
        <div className="glass-card p-2 flex flex-col md:flex-row gap-2 border-primary/5">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="FILTRAR POR NOMBRE O DESCRIPCIÓN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-11 h-10 text-[11px] font-bold tracking-widest uppercase"
            />
          </div>
          <button 
            onClick={fetchRoles}
            className="h-10 px-4 bg-muted hover:bg-border rounded-lg flex items-center gap-2 transition-all border border-border"
            title="Refrescar"
          >
            <RefreshCcw size={14} className={`${loading ? 'animate-spin' : ''} text-muted-foreground`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizar</span>
          </button>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredRoles.map((role, idx) => (
              <motion.div
                key={role.Id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-5 flex flex-col h-full hover:border-primary/20 transition-all group relative overflow-hidden"
              >
                {/* Accent line */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-all" />

                <div className="flex justify-between items-start mb-5 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                    <Shield size={20} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                      <Edit2 size={14} />
                    </button>
                    <button className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground transition-colors border border-transparent hover:border-destructive/20">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-sm font-black mb-2 uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {role.Nombre}
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium line-clamp-2 flex-1">
                  {role.Descripcion}
                </p>
                
                <div className="mt-6 pt-5 border-t border-border/40 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded border border-border">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">ID: {role.Id.toString().padStart(3, '0')}</span>
                  </div>
                  <button className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest hover:translate-x-1 transition-transform">
                    Permisos
                    <ChevronRight size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredRoles.length === 0 && !loading && (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-muted/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/50">
              <SearchX size={40} className="text-muted-foreground/20" />
            </div>
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-30">No se encontraron perfiles</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default RolesPage;
