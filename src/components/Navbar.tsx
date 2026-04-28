import { useNavigate, Link } from 'react-router-dom';
import { LogOut, User, Package, Users } from 'lucide-react';
import { storageService } from '../services/storageService';
import { ThemeToggle } from './ThemeToggle';

const Navbar = () => {
  const navigate = useNavigate();
  const user = storageService.getUser();

  const handleLogout = () => {
    storageService.clearAll();
    navigate('/login');
  };

  return (
    <nav className="h-20 glass-card !rounded-none !border-t-0 !border-x-0 px-6 md:px-10 flex items-center justify-between sticky top-0 z-50 transition-colors duration-300">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-primary p-2 rounded-lg group-hover:scale-110 transition-transform shadow-premium">
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden md:block text-foreground">
            DEVOLUCIONES <span className="text-primary">MT</span>
          </span>
        </Link>
        
        {user?.roleId === 1 && (
          <div className="h-8 w-[1px] bg-border hidden md:block" />
        )}
        
        {user?.roleId === 1 && (
          <Link 
            to="/users" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-sm font-medium"
          >
            <Users className="w-4 h-4" />
            <span>Usuarios</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-full border border-border">
          <User className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">{user?.name}</span>
        </div>

        <div className="h-8 w-[1px] bg-border hidden sm:block" />

        <ThemeToggle />
        
        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-colors group"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5 group-active:scale-90 transition-transform" />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

