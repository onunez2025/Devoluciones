import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Check, Search, Plus, Trash2, 
  ChevronRight, AlertCircle, Save
} from 'lucide-react';
import { rolesService, Role } from '../../services/rolesService';
import { toast } from 'react-hot-toast';

const ALL_PERMISSIONS = [
  { group: 'Tablero', perms: ['DASHBOARD_VIEW', 'DASHBOARD_EXPORT'] },
  { group: 'Devoluciones', perms: ['DEVOLUCIONES_VIEW', 'DEVOLUCIONES_CREATE', 'DEVOLUCIONES_EDIT', 'DEVOLUCIONES_EXPORT', 'DEVOLUCIONES_QR'] },
  { group: 'Configuración', perms: ['USERS_VIEW', 'USERS_EDIT', 'ROLES_VIEW', 'ROLES_EDIT'] },
  { group: 'Administrador', perms: ['ADMIN'] }
];

const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await rolesService.getRoles();
      setRoles(data);
      if (data.length > 0) {
        handleSelectRole(data[0]);
      }
    } catch (error) {
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (role: Role) => {
    setSelectedRole(role);
    try {
      const perms = await rolesService.getRolePermissions(role.Id);
      setRolePerms(perms);
    } catch (error) {
      toast.error('Error al cargar permisos');
    }
  };

  const handleTogglePerm = (perm: string) => {
    setRolePerms(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      await rolesService.updateRolePermissions(selectedRole.Id, rolePerms);
      toast.success('Permisos guardados correctamente');
    } catch (error) {
      toast.error('Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-600" />
          Roles y Permisos
        </h1>
        <p className="text-gray-500 mt-1">Configura los niveles de acceso por rol de usuario</p>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Roles List */}
        <div className="w-full md:w-80 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 uppercase text-xs tracking-wider">Lista de Roles</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {roles.map((role) => (
                <button
                  key={role.Id}
                  onClick={() => handleSelectRole(role)}
                  className={`w-full text-left px-5 py-4 flex items-center justify-between transition-all group ${
                    selectedRole?.Id === role.Id 
                      ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' 
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div>
                    <p className="font-medium">{role.Name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{role.Apps}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    selectedRole?.Id === role.Id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`} />
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-700 leading-relaxed">
                Los permisos se aplican inmediatamente al rol seleccionado. El permiso <strong>ADMIN</strong> otorga acceso total a todas las funciones.
              </p>
            </div>
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-800">Matriz de Permisos: <span className="text-indigo-600">{selectedRole?.Name}</span></h3>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selectedRole}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-95"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ALL_PERMISSIONS.map((group) => (
                <div key={group.group} className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-200"></span>
                    {group.group}
                  </h4>
                  <div className="space-y-2">
                    {group.perms.map((perm) => (
                      <label 
                        key={perm}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          rolePerms.includes(perm)
                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 ring-1 ring-indigo-200'
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                        }`}
                      >
                        <span className="text-xs font-mono font-medium">{perm}</span>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                          rolePerms.includes(perm) ? 'bg-indigo-600 text-white' : 'border-2 border-gray-200'
                        }`}>
                          {rolePerms.includes(perm) && <Check className="w-3 h-3" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={rolePerms.includes(perm)}
                          onChange={() => handleTogglePerm(perm)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesPage;
