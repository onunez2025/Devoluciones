import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Edit2, Shield, Trash2, 
  CheckCircle, XCircle, Mail, Briefcase, Filter
} from 'lucide-react';
import { usersService, User } from '../../services/usersService';
import { rolesService, Role } from '../../services/rolesService';
import { managementsService, Management } from '../../services/managementsService';
import { toast } from 'react-hot-toast';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [managements, setManagements] = useState<Management[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    Username: '',
    Email: '',
    FullName: '',
    Password: '',
    RoleId: '',
    ManagementId: '',
    Apps: 'DEV',
    IsActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, managementsData] = await Promise.all([
        usersService.getUsers(),
        rolesService.getRoles(),
        managementsService.getManagements()
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setManagements(managementsData);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user: User | null = null) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        Username: user.Username,
        Email: user.Email,
        FullName: user.FullName,
        Password: '',
        RoleId: user.RoleId,
        ManagementId: user.ManagementId,
        Apps: user.Apps,
        IsActive: user.IsActive
      });
      setIsEditing(true);
    } else {
      setSelectedUser(null);
      setFormData({
        Username: '',
        Email: '',
        FullName: '',
        Password: '',
        RoleId: '',
        ManagementId: '',
        Apps: 'DEV',
        IsActive: true
      });
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedUser) {
        await usersService.updateUser(selectedUser.Id!, formData);
        toast.success('Usuario actualizado');
      } else {
        await usersService.createUser(formData);
        toast.success('Usuario creado');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Error al guardar usuario');
    }
  };

  const filteredUsers = users.filter(user => 
    user.FullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.Username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.Email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-gray-500 mt-1">Administra los accesos y perfiles de la plataforma</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario o email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 text-gray-600">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">{filteredUsers.length} Usuarios</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol / Gerencia</th>
                <th className="px-6 py-4">Aplicaciones</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.Id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {user.FullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{user.FullName}</p>
                          <p className="text-sm text-gray-500">{user.Username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Shield className="w-4 h-4 text-orange-500" />
                          {user.RoleName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Briefcase className="w-3.5 h-3.5" />
                          {user.ManagementName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.Apps.split(',').map(app => (
                          <span key={app} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                            {app.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.IsActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <XCircle className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
                  <input
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.FullName}
                    onChange={(e) => setFormData({...formData, FullName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Usuario</label>
                  <input
                    required
                    disabled={isEditing}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                    value={formData.Username}
                    onChange={(e) => setFormData({...formData, Username: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.Email}
                    onChange={(e) => setFormData({...formData, Email: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Password {isEditing && '(Dejar en blanco para mantener)'}</label>
                  <input
                    type="password"
                    required={!isEditing}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.Password}
                    onChange={(e) => setFormData({...formData, Password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Rol</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.RoleId}
                    onChange={(e) => setFormData({...formData, RoleId: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {roles.map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Gerencia</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.ManagementId}
                    onChange={(e) => setFormData({...formData, ManagementId: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {managements.map(m => <option key={m.Id} value={m.Id}>{m.Name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.IsActive}
                  onChange={(e) => setFormData({...formData, IsActive: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700 font-medium cursor-pointer">Usuario Activo</label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
