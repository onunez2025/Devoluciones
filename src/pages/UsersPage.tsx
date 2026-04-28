import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Mail, 
  User as UserIcon,
  Trash2,
  Edit2,
  Loader2,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { User } from '../types';

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Users size={18} />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">Recursos Humanos</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Gestión de Usuarios</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Control de accesos y perfiles administrativos</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary h-11 px-6 shadow-glow"
        >
          <UserPlus size={18} />
          <span className="text-[11px] font-black uppercase tracking-widest">Nuevo Usuario</span>
        </button>
      </div>

      {/* Unified Filter Bar */}
      <div className="glass-card p-2 flex flex-col md:flex-row gap-2 border-primary/5">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder="BUSCAR POR NOMBRE O USUARIO..."
            className="glass-input w-full pl-11 h-10 text-[11px] font-bold tracking-widest"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="h-10 px-4 bg-muted hover:bg-border rounded-lg flex items-center gap-2 transition-all border border-border">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtros</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="table-container border-primary/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-header bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Colaborador</th>
                <th className="px-5 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Credenciales</th>
                <th className="px-5 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Nivel de Acceso</th>
                <th className="px-5 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Estado</th>
                <th className="px-5 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Sincronizando Usuarios...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-30">No se encontraron registros</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="table-row group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                          <UserIcon size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[12px] font-black text-foreground uppercase tracking-tight">{user.fullName}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">ID: #{user.id.toString().padStart(4, '0')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted rounded-md border border-border">
                          <Mail size={12} className="text-muted-foreground" />
                        </div>
                        <span className="text-[11px] font-bold text-foreground lowercase">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${user.roleId === 1 ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]' : 'bg-blue-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${user.roleId === 1 ? 'text-primary' : 'text-blue-500'}`}>
                          {user.roleId === 1 ? 'Administrador' : 'Operador'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-md inline-flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-green-500 rounded-full" />
                        <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-tighter">Activo</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                          <Edit2 size={14} />
                        </button>
                        <button className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors border border-transparent hover:border-destructive/20">
                          <Trash2 size={14} />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
