import React, { useState, useEffect, createContext, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Database, Key, Settings, BarChart3, Webhook,
  ChevronDown, LogOut, Menu, X, Zap, Home, Plus
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Auth Context for Dashboard
const DashboardAuthContext = createContext();

export const useDashboardAuth = () => useContext(DashboardAuthContext);

export const DashboardAuthProvider = ({ children }) => {
  const [tenant, setTenant] = useState(() => {
    const saved = localStorage.getItem('searchy_tenant');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('searchy_api_key') || null;
  });

  const [jwtToken, setJwtToken] = useState(() => {
    return localStorage.getItem('searchy_jwt_token') || null;
  });

  const [oauthNewKey, setOauthNewKey] = useState(null);

  // Handle OAuth callback (token in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const newApiKey = params.get('api_key');
    const isNew = params.get('new');

    if (token) {
      // Verify token and get tenant info
      verifyToken(token);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      if (newApiKey && isNew === 'true') {
        setOauthNewKey(newApiKey);
      }
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/v1/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTenant(data.tenant);
        setJwtToken(token);
        localStorage.setItem('searchy_tenant', JSON.stringify(data.tenant));
        localStorage.setItem('searchy_jwt_token', token);
        
        // If we got an API key hint, use it
        if (data.api_key_hint) {
          setApiKey(data.api_key_hint);
          localStorage.setItem('searchy_api_key', data.api_key_hint);
        }
      }
    } catch (err) {
      console.error('Failed to verify token:', err);
    }
  };

  const login = (tenantData, key) => {
    setTenant(tenantData);
    setApiKey(key);
    localStorage.setItem('searchy_tenant', JSON.stringify(tenantData));
    localStorage.setItem('searchy_api_key', key);
  };

  const logout = () => {
    setTenant(null);
    setApiKey(null);
    setJwtToken(null);
    setOauthNewKey(null);
    localStorage.removeItem('searchy_tenant');
    localStorage.removeItem('searchy_api_key');
    localStorage.removeItem('searchy_jwt_token');
  };

  return (
    <DashboardAuthContext.Provider value={{ 
      tenant, 
      apiKey, 
      jwtToken,
      oauthNewKey,
      clearOauthNewKey: () => setOauthNewKey(null),
      login, 
      logout, 
      isAuthenticated: !!apiKey || !!jwtToken 
    }}>
      {children}
    </DashboardAuthContext.Provider>
  );
};

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Overview', exact: true },
  { path: '/dashboard/indices', icon: Database, label: 'Indices' },
  { path: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { path: '/dashboard/webhooks', icon: Webhook, label: 'Webhooks' },
  { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, logout, isAuthenticated } = useDashboardAuth();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/dashboard/login');
    }
  }, [isAuthenticated, navigate]);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-md"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-20'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Searchy
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${sidebarOpen ? 'rotate-90' : '-rotate-90'}`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {tenant && sidebarOpen && (
            <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Organization</p>
              <p className="font-medium text-gray-900 truncate">{tenant.name}</p>
              <span className={`
                inline-block mt-1 px-2 py-0.5 text-xs rounded-full
                ${tenant.plan === 'free' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}
              `}>
                {tenant.plan || 'Free'} Plan
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
