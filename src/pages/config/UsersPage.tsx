import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Edit2, Shield,
  CheckCircle, XCircle, Briefcase, Filter
} from 'lucide-react';
import { usersService, User } from '../../services/usersService';
import { rolesService, Role } from '../../services/rolesService';
import { managementsService, Management } from '../../services/managementsService';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { cn } from '../../utils/cn';

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
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
      toast.error(t('users.toast.loadError'));
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
        toast.success(t('users.toast.updated'));
      } else {
        await usersService.createUser(formData);
        toast.success(t('users.toast.created'));
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(t('users.toast.saveError'));
    }
  };

  const filteredUsers = users.filter(user =>
    user.FullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.Username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.Email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 w-full flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
            <Users className="w-6 h-6 text-primary inline-block mr-2" />
            {t('users.title')}
          </h1>
          <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('users.subtitle')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
        >
          <UserPlus className="w-4 h-4 mr-1" />
          {t('users.newUser')}
        </button>
      </div>

      <div className={cn(
        "bg-card border border-cb-border shadow-cb-level-1 overflow-hidden",
        SIATC_THEME.TOKENS.MASTER_ROUNDNESS
      )}>
        <div className="p-4 border-b border-cb-border bg-cb-bg/30 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-5 h-5" />
            <input
              type="text"
              placeholder={t('users.search')}
              className={SIATC_THEME.COMPONENTS.INPUT}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-background border border-cb-border rounded-lg text-cb-text-secondary text-xs font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>{t('users.count', { count: filteredUsers.length })}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="sticky top-0 z-20 bg-card border-b border-cb-border shadow-sm">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('users.table.user')}</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('users.table.roleManagement')}</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('users.table.apps')}</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{t('users.table.status')}</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground opacity-60">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground/50">
                    {t('users.loading')}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground/50">
                    {t('users.empty')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.Id} className="h-[64px] group hover:bg-cb-bg transition-colors border-b border-cb-border/60">
                    <td className="px-6 py-4 font-sans text-cb-text-primary">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {user.FullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.FullName}</p>
                          <p className="text-sm text-muted-foreground">{user.Username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-sans text-cb-text-primary">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Shield className="w-4 h-4 text-orange-500" />
                          {user.RoleName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Briefcase className="w-3.5 h-3.5" />
                          {user.ManagementName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-sans text-cb-text-primary">
                      <div className="flex flex-wrap gap-1">
                        {user.Apps.split(',').map(app => (
                          <span key={app} className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px] font-bold uppercase border border-border/50">
                            {app.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-sans text-cb-text-primary">
                      {user.IsActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 text-emerald-600 text-xs font-medium border border-green-500/20">
                          <CheckCircle className="w-3 h-3" /> {t('common.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/20">
                          <XCircle className="w-3 h-3" /> {t('common.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans text-cb-text-primary text-right">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title={t('common.edit')}
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
          <div className={cn(
            "bg-card text-cb-text-primary border border-cb-border shadow-cb-level-3 p-6 overflow-hidden w-full max-w-lg animate-in fade-in zoom-in duration-200",
            SIATC_THEME.TOKENS.RADIUS.MODAL
          )}>
            <div className="pb-4 border-b border-cb-border">
              <h2 className="text-xl font-bold text-foreground">
                {t(isEditing ? 'users.modal.editTitle' : 'users.modal.newTitle')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('users.modal.fullName')}</label>
                  <input
                    required
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={formData.FullName}
                    onChange={(e) => setFormData({...formData, FullName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('users.modal.username')}</label>
                  <input
                    required
                    disabled={isEditing}
                    className={cn(SIATC_THEME.COMPONENTS.INPUT, "disabled:bg-muted/40 disabled:cursor-not-allowed")}
                    value={formData.Username}
                    onChange={(e) => setFormData({...formData, Username: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('users.modal.email')}</label>
                  <input
                    type="email"
                    required
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={formData.Email}
                    onChange={(e) => setFormData({...formData, Email: e.target.value})}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">
                    {t('users.modal.password')} {isEditing && <span className="font-normal normal-case">{t('users.modal.passwordHint')}</span>}
                  </label>
                  <input
                    type="password"
                    required={!isEditing}
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={formData.Password}
                    onChange={(e) => setFormData({...formData, Password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('users.modal.role')}</label>
                  <select
                    required
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={formData.RoleId}
                    onChange={(e) => setFormData({...formData, RoleId: e.target.value})}
                  >
                    <option value="">{t('common.selectOption')}</option>
                    {roles.map(r => <option key={r.Id} value={r.Id}>{r.Name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('users.modal.management')}</label>
                  <select
                    required
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={formData.ManagementId}
                    onChange={(e) => setFormData({...formData, ManagementId: e.target.value})}
                  >
                    <option value="">{t('common.selectOption')}</option>
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
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm text-foreground font-medium cursor-pointer">{t('users.modal.isActive')}</label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-cb-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={SIATC_THEME.COMPONENTS.BUTTON_SECONDARY}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
                >
                  {t(isEditing ? 'users.modal.saveChanges' : 'users.modal.createUser')}
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
