import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Smartphone,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  AlertTriangle,
  Download,
  Lock,
  History,
  Fingerprint,
  Barcode,
  X,
} from 'lucide-react';
import { AppUser, AccessLog, UserRole } from '../types';
import { AuthService } from '../services/authService';

interface UserManagementViewProps {
  currentUser: AppUser;
  onUserChanged: (user: AppUser) => void;
  onOpenLoginModal: () => void;
  onScanSearch?: (callback: (val: string) => void) => void;
}

const AVATAR_COLORS = [
  '#0284c7', // Sky Blue
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  onUserChanged,
  onOpenLoginModal,
  onScanSearch,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('all');

  // Modal create/edit user
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formPhoneLock, setFormPhoneLock] = useState(true);
  const [formColor, setFormColor] = useState(AVATAR_COLORS[0]);
  const [showPinInput, setShowPinInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const loadData = () => {
    setUsers(AuthService.getUsers());
    setAccessLogs(AuthService.getAccessLogs());
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormName('');
    setFormUsername('');
    setFormPin('1234');
    setFormRole('user');
    setFormPhoneLock(true);
    setFormColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    setEditingUserId(user.id);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPin(user.pin);
    setFormRole(user.role);
    setFormPhoneLock(user.phoneLockEnabled);
    setFormColor(user.avatarColor || AVATAR_COLORS[0]);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('El nombre del usuario es obligatorio');
      return;
    }
    if (!formUsername.trim()) {
      setErrorMessage('El nombre de usuario o alias es obligatorio');
      return;
    }
    if (!formPin.trim()) {
      setErrorMessage('La contraseña o PIN es obligatorio');
      return;
    }

    if (editingUserId) {
      // Editing existing user
      const existing = users.find((u) => u.id === editingUserId);
      if (existing) {
        const updated: AppUser = {
          ...existing,
          name: formName.trim(),
          username: formUsername.toLowerCase().trim().replace(/\s+/g, ''),
          pin: formPin.trim(),
          role: formRole,
          phoneLockEnabled: formPhoneLock,
          avatarColor: formColor,
        };
        AuthService.updateUser(updated);
        showToast(`Usuario ${updated.name} actualizado con éxito`);
      }
    } else {
      // Creating new user
      const created = AuthService.addUser({
        name: formName,
        username: formUsername,
        pin: formPin,
        role: formRole,
        phoneLockEnabled: formPhoneLock,
        avatarColor: formColor,
      });
      showToast(`Nuevo usuario ${created.name} creado con éxito`);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteUser = (user: AppUser) => {
    if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${user.name}"?`)) {
      const res = AuthService.deleteUser(user.id);
      if (res.success) {
        showToast(`Usuario ${user.name} eliminado`);
        loadData();
      } else {
        alert(res.error || 'No se pudo eliminar el usuario');
      }
    }
  };

  const handleClearAuditLogs = () => {
    if (confirm('¿Deseas vaciar el registro histórico de accesos?')) {
      AuthService.clearAccessLogs();
      setAccessLogs([]);
      showToast('Registro de accesos vaciado');
    }
  };

  const handleExportAuditLogs = () => {
    const lines = [
      'FECHA Y HORA,USUARIO,ROL,METODO,RESULTADO,DISPOSITIVO,NOTAS',
      ...accessLogs.map((l) =>
        `"${new Date(l.timestamp).toLocaleString()}","${l.userName}","${l.userRole}","${l.method}","${
          l.success ? 'EXITOSO' : 'FALLIDO'
        }","${l.deviceInfo || ''}","${l.notes || ''}"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_accesos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo CSV de auditoría descargado');
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = accessLogs.filter((log) => {
    if (auditFilter === 'success' && !log.success) return false;
    if (auditFilter === 'failed' && log.success) return false;
    if (auditUserFilter !== 'all' && log.userId !== auditUserFilter) return false;
    return true;
  });

  const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;
  const operatorCount = users.filter((u) => u.role === 'user' && u.isActive).length;
  const phoneLockCount = users.filter((u) => u.phoneLockEnabled && u.isActive).length;

  return (
    <div id="user-management-view" className="p-4 space-y-4 pb-28 max-w-4xl mx-auto animate-fade-in">
      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-slide-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-gradient-to-br from-[#151926] via-[#10131d] to-[#0c0e15] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shadow-inner flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white">Panel Principal de Usuarios</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Control de Administradores
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Gestiona administradores, usuarios y bloqueo con celular o contraseña.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLoginModal}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Cambiar usuario o bloquear pantalla"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Cambiar Usuario</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-white/10">
          <div className="bg-[#191d2c] p-2.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Administradores</span>
            </div>
            <p className="text-lg font-black text-white font-mono mt-0.5">{adminCount}</p>
            <p className="text-[9px] text-zinc-500">Acceso total y auditoría</p>
          </div>

          <div className="bg-[#191d2c] p-2.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
              <Users className="w-3.5 h-3.5" />
              <span>Usuarios / Operadores</span>
            </div>
            <p className="text-lg font-black text-white font-mono mt-0.5">{operatorCount}</p>
            <p className="text-[9px] text-zinc-500">Reposición, stock y ventas</p>
          </div>

          <div className="bg-[#191d2c] p-2.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-sky-400 text-[11px] font-semibold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Bloqueo Celular</span>
            </div>
            <p className="text-lg font-black text-white font-mono mt-0.5">{phoneLockCount}</p>
            <p className="text-[9px] text-zinc-500">Biometría / pantalla activa</p>
          </div>
        </div>
      </div>

      {/* Main Tabs: Usuarios vs Auditoría para Administradores */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'users'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Usuarios ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'audit'
              ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Auditoría de Accesos ({accessLogs.length})</span>
          {accessLogs.some((l) => !l.success) && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      </div>

      {/* TAB 1: GESTIÓN DE USUARIOS */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Search bar with Barcode Scanner */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuario por nombre o alias..."
              className="w-full bg-[#12151f] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-white text-xs p-0.5"
                  title="Limpiar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {onScanSearch && (
                <button
                  type="button"
                  id="btn-scan-user-search"
                  onClick={() => onScanSearch((val: string) => setSearchQuery(val))}
                  className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors"
                  title="Escanear credencial o código"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* User cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredUsers.map((user) => {
              const isAdmin = user.role === 'admin';
              const isCurrent = currentUser.id === user.id;

              return (
                <div
                  key={user.id}
                  className={`bg-[#141724] border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'border-sky-500/40 shadow-lg shadow-sky-500/5 bg-[#171b2b]'
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  <div>
                    {/* Card Top */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                          style={{ backgroundColor: user.avatarColor || (isAdmin ? '#0284c7' : '#10b981') }}
                        >
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-white">{user.name}</h4>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                Sesión Actual
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono">@{user.username}</p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAdmin
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isAdmin ? 'Administrador' : 'Usuario'}
                      </span>
                    </div>

                    {/* Security credentials badges */}
                    <div className="mt-3.5 space-y-1.5 bg-[#0f111a] p-2.5 rounded-xl border border-white/5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-amber-400" />
                          <span>Contraseña / PIN:</span>
                        </span>
                        <span className="font-mono font-bold text-white tracking-widest">
                          •••• {user.pin ? `(${user.pin.length} carácteres)` : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-sky-400" />
                          <span>Bloqueo Celular / Huella:</span>
                        </span>
                        <span
                          className={`font-semibold ${
                            user.phoneLockEnabled ? 'text-emerald-400' : 'text-zinc-500'
                          }`}
                        >
                          {user.phoneLockEnabled ? 'Habilitado' : 'Desactivado'}
                        </span>
                      </div>

                      {user.lastLogin && (
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
                          <span>Último acceso:</span>
                          <span className="font-mono text-zinc-400">
                            {new Date(user.lastLogin).toLocaleString('es-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => {
                        AuthService.setCurrentUser(user);
                        onUserChanged(user);
                        showToast(`Cambiado a usuario: ${user.name}`);
                      }}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activar sesión</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Editar usuario y clave"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: AUDITORÍA DE ACCESOS PARA ADMINISTRADORES */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {/* Audit Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#141724] p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter result */}
              <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/5 text-xs">
                <button
                  onClick={() => setAuditFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    auditFilter === 'all' ? 'bg-white/10 text-white' : 'text-zinc-400'
                  }`}
                >
                  Todos ({accessLogs.length})
                </button>
                <button
                  onClick={() => setAuditFilter('success')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    auditFilter === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  Exitosos
                </button>
                <button
                  onClick={() => setAuditFilter('failed')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    auditFilter === 'failed' ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-400'
                  }`}
                >
                  Fallidos
                </button>
              </div>

              {/* Filter user */}
              <select
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                className="bg-black/40 border border-white/10 text-xs text-white rounded-xl px-2.5 py-1 focus:outline-none"
              >
                <option value="all">Todos los usuarios</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAuditLogs}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-semibold flex items-center gap-1.5 transition-colors"
                title="Exportar a CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={handleClearAuditLogs}
                className="px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Vaciar historial de accesos"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            </div>
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-[#141724] border border-white/5 rounded-2xl">
              <History className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No hay registros de acceso con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const dateStr = new Date(log.timestamp).toLocaleString('es-ES', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                      log.success
                        ? 'bg-[#141724] border-white/5 hover:border-white/10'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          log.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{log.userName}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              log.userRole === 'admin'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {log.userRole === 'admin' ? 'Admin' : 'Operador'}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-zinc-300">
                            {log.method === 'device_lock' ? (
                              <Smartphone className="w-3 h-3 text-sky-400" />
                            ) : log.method === 'biometric' ? (
                              <Fingerprint className="w-3 h-3 text-purple-400" />
                            ) : (
                              <KeyRound className="w-3 h-3 text-amber-400" />
                            )}
                            {log.method === 'device_lock'
                              ? 'Bloqueo Celular / Biometría'
                              : 'Contraseña / PIN'}
                          </span>
                          {log.deviceInfo && (
                            <>
                              <span>•</span>
                              <span>{log.deviceInfo}</span>
                            </>
                          )}
                          {log.notes && (
                            <>
                              <span>•</span>
                              <span className="italic text-zinc-300">{log.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          log.success
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.success ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-[#141724] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                <span>{editingUserId ? 'Editar Usuario' : 'Nuevo Usuario / Administrador'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1 block">
                  Nombre Completo / Empleado:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Juan Gómez (Caja Tarde)"
                  className="w-full bg-[#0f1118] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1 block">
                  Usuario o Alias (sin espacios):
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="ej. juang"
                  className="w-full bg-[#0f1118] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1 block">
                  Rol en el Negocio:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formRole === 'admin'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                        : 'bg-[#0f1118] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Administrador</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Control total y auditoría</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('user')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formRole === 'user'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                        : 'bg-[#0f1118] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Usuario / Operador</span>
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Stock, reposición y compras</p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Contraseña o PIN (numérico o texto):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPinInput(!showPinInput)}
                    className="text-[10px] text-zinc-400 hover:text-white"
                  >
                    {showPinInput ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <input
                  type={showPinInput ? 'text' : 'password'}
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="ej. 1234 o clave segura"
                  className="w-full bg-[#0f1118] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 font-mono tracking-wider"
                  required
                />
              </div>

              {/* Phone Lock Checkbox */}
              <div className="p-3 rounded-xl bg-[#0f1118] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <div>
                    <p className="text-xs font-bold text-white">Bloqueo de Celular / Huella</p>
                    <p className="text-[10px] text-zinc-400">
                      Permitir desbloqueo con la seguridad principal del móvil
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formPhoneLock}
                  onChange={(e) => setFormPhoneLock(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 bg-zinc-800 border-zinc-700"
                />
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                  Color Identificador de Usuario:
                </label>
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all ${
                        formColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141724] scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                  {errorMessage}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/20"
                >
                  {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
