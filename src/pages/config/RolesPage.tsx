import React, { useState, useEffect } from 'react';
import {
  Shield, Key, Check,
  ChevronRight, AlertCircle, Save
} from 'lucide-react';
import { rolesService, Role } from '../../services/rolesService';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { cn } from '../../utils/cn';

const ALL_PERMISSIONS = [
  { group: 'Tablero', perms: ['DASHBOARD_VIEW', 'DASHBOARD_EXPORT'] },
  { group: 'Devoluciones', perms: ['DEVOLUCIONES_VIEW', 'DEVOLUCIONES_CREATE', 'DEVOLUCIONES_EDIT', 'DEVOLUCIONES_EXPORT', 'DEVOLUCIONES_QR'] },
  { group: 'Configuración', perms: ['USERS_VIEW', 'USERS_EDIT', 'ROLES_VIEW', 'ROLES_EDIT'] },
  { group: 'Administrador', perms: ['ADMIN'] }
];

const RolesPage: React.FC = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [, setLoading] = useState(true);
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
      toast.error(t('roles.toast.rolesError'));
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
      toast.error(t('roles.toast.permsError'));
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
      toast.success(t('roles.toast.permsSaved'));
    } catch (error) {
      toast.error(t('roles.toast.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-6 animate-in fade-in duration-700 h-full min-h-0">
      <div className="flex flex-col gap-2">
        <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
          <Shield className="w-6 h-6 text-primary inline-block mr-2" />
          {t('roles.title')}
        </h1>
        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('roles.subtitle')}</p>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden min-h-0 flex-col md:flex-row">
        {/* Roles List */}
        <div className="w-full md:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar">
          <div className={cn(
            "bg-card border border-cb-border shadow-cb-level-1 overflow-hidden",
            SIATC_THEME.TOKENS.MASTER_ROUNDNESS
          )}>
            <div className="p-4 border-b border-cb-border bg-cb-bg/30">
              <h3 className="font-semibold text-cb-text-secondary uppercase text-xs tracking-wider">{t('roles.list')}</h3>
            </div>
            <div className="divide-y divide-cb-border/50">
              {roles.map((role) => (
                <button
                  key={role.Id}
                  onClick={() => handleSelectRole(role)}
                  className={cn(
                    "w-full text-left px-5 py-4 flex items-center justify-between transition-all group border-l-4 border-transparent",
                    selectedRole?.Id === role.Id
                      ? 'bg-primary/5 text-primary border-l-primary font-bold'
                      : 'hover:bg-muted/40 text-cb-text-secondary'
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">{role.Name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{role.Apps}</p>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-primary transition-transform",
                    selectedRole?.Id === role.Id ? 'translate-x-1 opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )} />
                </button>
              ))}
            </div>
          </div>

          <div className={cn(
            "p-4 bg-primary/5 border border-primary/20",
            SIATC_THEME.TOKENS.MASTER_ROUNDNESS
          )}>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-primary shrink-0" />
              <p className="text-xs text-primary leading-relaxed font-medium">
                {t('roles.note')}
              </p>
            </div>
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className={cn(
          "flex-1 flex flex-col bg-card border border-cb-border shadow-cb-level-1 overflow-hidden min-h-0",
          SIATC_THEME.TOKENS.MASTER_ROUNDNESS
        )}>
          <div className="p-4 border-b border-cb-border bg-cb-bg/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-muted-foreground/60" />
              <h3 className="font-semibold text-foreground">{t('roles.matrix')}: <span className="text-primary">{selectedRole?.Name}</span></h3>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selectedRole}
              className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
            >
              <Save className="w-4 h-4 mr-1" />
              {saving ? t('roles.saving') : t('roles.saveChanges')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ALL_PERMISSIONS.map((group) => (
                <div key={group.group} className="space-y-3">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/30"></span>
                    {t(`roles.groups.${group.group}`, group.group)}
                  </h4>
                  <div className="space-y-2">
                    {group.perms.map((perm) => (
                      <label
                        key={perm}
                        className={cn(
                          "flex items-center justify-between p-3 border cursor-pointer transition-all",
                          rolePerms.includes(perm)
                            ? 'bg-primary/5 border-primary/20 text-foreground ring-1 ring-primary/10'
                            : 'bg-card border-cb-border text-cb-text-secondary hover:border-cb-border/80',
                          SIATC_THEME.TOKENS.RADIUS.BUTTON
                        )}
                      >
                        <span className="text-xs font-mono font-medium">{perm}</span>
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                          rolePerms.includes(perm) ? 'bg-primary text-primary-foreground' : 'border-2 border-cb-border bg-background'
                        )}>
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
