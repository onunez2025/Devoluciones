import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { storageService } from '../services/storageService';
import { ThemeToggle } from '../components/ThemeToggle';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', { username, password });
      const { token, user } = response.data;
      
      storageService.setToken(token);
      storageService.setUser(user);
      
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-20"
      >
        <div className="glass-card p-8 md:p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-20 h-20 bg-primary/20 flex items-center justify-center rounded-2xl mb-6 shadow-glow"
            >
              <LogIn className="w-10 h-10 text-primary" />
            </motion.div>
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight text-center uppercase">Bienvenido</h1>
            <p className="text-[10px] text-muted-foreground text-center uppercase tracking-[0.2em]">Plataforma de Devoluciones</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-30">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Credencial de Usuario</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10" />
                <input 
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="glass-input w-full pl-11 h-11 text-[12px] font-bold tracking-widest uppercase relative z-30 cursor-text"
                  placeholder="USUARIO"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Frase de Seguridad</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none z-10" />
                <input 
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-11 h-11 text-[12px] relative z-30 cursor-text"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3 text-destructive text-sm"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full h-11 flex items-center justify-center gap-2 group relative z-30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[11px] uppercase tracking-widest">Verificando...</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] uppercase tracking-widest font-bold">Iniciar sesión</span>
                  <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 pt-8 border-t border-border/50 text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              © {new Date().getFullYear()} NoCodeCreator
            </p>
          </div>
        </div>
      </motion.div>

      {/* Background Decor - Movido al final y con z-0 */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] animate-pulse pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px] animate-pulse pointer-events-none z-0" style={{ animationDelay: '2s' }} />
    </div>
  );
};

export default LoginPage;

