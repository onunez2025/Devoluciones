const TOKEN_KEY = 'auth_token';
const USER_KEY = 'current_user';

export const storageService = {
  setToken: (token: string, _remember = true) => localStorage.setItem(TOKEN_KEY, token),
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  setUser: (user: any, _remember = true) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  getUser: (): any | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clearUser: () => localStorage.removeItem(USER_KEY),

  // Aliases usados por useAuth.tsx (compatibilidad con ecosistema)
  setCurrentUser: (user: any, remember = true) => storageService.setUser(user, remember),
  getCurrentUser: (): any | null => storageService.getUser(),
  remove: (key: string) => localStorage.removeItem(key),

  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};
