import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import apiClient from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../context/AppConfigContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { SIATC_THEME } from '../utils/siatc-theme';
import { cn } from '../utils/cn';

export default function LoginPage() {
    const { login } = useAuth();
    const { refreshApplications } = useAppConfig();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const cleanUsername = username.trim().toLowerCase();

        try {
            const response = await apiClient.post('/auth/login', { 
                username: cleanUsername, 
                password,
                remember: rememberMe 
            });
            const { token, user, sessionConfig } = response.data;

            login(user, token, rememberMe, sessionConfig);
            refreshApplications();
            navigate('/');
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Error al iniciar sesión. Verifique sus credenciales.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={SIATC_THEME.LOGIN_LAYOUT.CONTAINER}>
            {/* Left Side - Brand / Visual */}
            <div className={cn(SIATC_THEME.LOGIN_LAYOUT.LEFT_PANEL, "h-screen min-h-screen relative flex flex-col justify-between p-12")}>
                {/* Abstract Background Pattern */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+IDxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0ibm9uZSIvPiA8ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjIiPiA8cGF0aCBkPSJNMCAzdjU0TTMgMGg1NCIvPiA8L2c+IDwvc3ZnPg==')] bg-[size:60px_60px] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900/50 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden">
                                <img src="/Logo.png" alt="Devoluciones Logo" className="h-full w-full object-contain" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight uppercase">Devoluciones</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-4 leading-tight text-white">
                            Gestión de<br />Devoluciones<br />y Garantías
                        </h1>
                        <div className="text-slate-400 text-lg max-w-md space-y-6">
                            <p>Control integrado de solicitudes de devoluciones, aprobaciones técnicas y garantías de productos.</p>
                            <div className="flex flex-col w-fit gap-2">
                                <span className="text-2xl font-bold text-slate-100 tracking-tight">Gerencia de Atención al Cliente</span>
                                <img 
                                    src="https://res.cloudinary.com/dvfljye2u/image/upload/v1781643958/Logo_-_Grupo_Sole_-_Transparente_blanco-_of11va.png" 
                                    alt="Logo Grupo Sole" 
                                    className="h-auto max-w-[12rem] object-contain"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-sm text-slate-500 mt-8">
                        © 2026 GAC - Grupo Sole. Rinnai Corporation. Todos los derechos reservados.
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className={SIATC_THEME.LOGIN_LAYOUT.RIGHT_PANEL}>
                {/* Top Right Controls */}
                <div className="absolute top-6 right-6 flex items-center gap-4">
                    <ThemeToggle />
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md space-y-8"
                >
                    <div className="text-center">
                        <h2 className={SIATC_THEME.LOGIN_LAYOUT.TITLE}>¡Bienvenido a Devoluciones!</h2>
                        <p className={SIATC_THEME.LOGIN_LAYOUT.SUBTITLE}>
                            Ingresa tus credenciales para acceder a la plataforma.
                        </p>
                    </div>

                    <div className={SIATC_THEME.LOGIN_LAYOUT.CARD}>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 ml-1">
                                        Usuario
                                    </label>
                                    <div className={SIATC_THEME.LOGIN_LAYOUT.INPUT_WRAPPER}>
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                            className={SIATC_THEME.LOGIN_LAYOUT.INPUT}
                                            placeholder="Ingrese usuario"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 ml-1">
                                        Contraseña
                                    </label>
                                    <div className={SIATC_THEME.LOGIN_LAYOUT.INPUT_WRAPPER}>
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={SIATC_THEME.LOGIN_LAYOUT.INPUT}
                                            placeholder="Ingrese contraseña"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-cb-border text-primary focus:ring-primary" 
                                    />
                                    <span className="text-muted-foreground">Recordarme</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setError('Por favor, contacta a tu administrador de sistemas para recuperar tu clave.')}
                                    className="font-medium text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                    "w-full flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                )}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Iniciando sesión...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Iniciar Sesión</span>
                                        <LogIn className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
