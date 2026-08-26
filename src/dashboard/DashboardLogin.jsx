import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Key, ArrowRight, AlertCircle, Building2, Play, Github, Search, Mail, Lock, CheckCircle, Copy } from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Demo credentials for testing
const DEMO_TENANT = {
  id: 'demo-tenant-001',
  name: 'Demo Company',
  email: 'demo@searchy.ai',
  plan: 'pro',
  status: 'active',
  created_at: new Date().toISOString(),
};
const DEMO_API_KEY = 'sk_demo_searchy_dashboard_preview';

// Google icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const DashboardLogin = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [showApiKeyLogin, setShowApiKeyLogin] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  
  const navigate = useNavigate();
  const { login, tenant } = useDashboardAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (tenant) {
      navigate('/dashboard');
    }
  }, [tenant, navigate]);

  // Update mode when URL params change
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'register') {
      setMode('register');
    }
  }, [searchParams]);

  // Clear error when switching modes
  useEffect(() => {
    setError('');
  }, [mode, showApiKeyLogin]);

  const handleApiKeyLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/v1/tenants/me`, {
        headers: { 'X-API-Key': apiKey },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail?.message || 'Invalid API key');
      }

      const tenantData = await response.json();
      login(tenantData, apiKey);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail?.message || 'Invalid email or password');
      }

      const data = await response.json();
      login(data.tenant, data.api_key_hint || 'authenticated');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tenantName, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail?.message || 'Failed to create account');
      }

      const data = await response.json();
      setNewApiKey(data.api_key);
      login(data.tenant, data.api_key);
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    login(DEMO_TENANT, DEMO_API_KEY);
    navigate('/dashboard');
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/v1/auth/google`;
  };

  const handleGithubLogin = () => {
    window.location.href = `${API_BASE}/v1/auth/github`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Success screen after registration
  if (newApiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Searchy!</h1>
            <p className="text-gray-600 mt-2">Your account has been created successfully.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium mb-2">⚠️ Save your API key — it won't be shown again!</p>
            <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm break-all font-mono">
              {newApiKey}
            </code>
          </div>

          <button
            onClick={handleCopy}
            className="w-full mb-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Search className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign in to Searchy' : 'Create your account'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {mode === 'login' 
              ? 'Access your search dashboard'
              : 'Start building in minutes'
            }
          </p>
        </div>

        {/* Demo Banner */}
        <button
          onClick={handleDemoLogin}
          className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-200 rounded-xl hover:from-purple-100 hover:to-indigo-100 transition-colors flex items-center justify-center gap-2 group"
        >
          <Play size={16} className="text-indigo-600" />
          <span className="text-indigo-700 font-medium">Try the Demo</span>
          <span className="text-indigo-400 text-sm">— no signup required</span>
        </button>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* API Key Login (alternative view) */}
        {showApiKeyLogin ? (
          <form onSubmit={handleApiKeyLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Enter your API key to access the dashboard</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>Sign In<ArrowRight size={18} /></>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowApiKeyLogin(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back to email login
            </button>
          </form>
        ) : mode === 'login' ? (
          /* Email Login Form */
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <>Sign In<ArrowRight size={18} /></>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400 uppercase tracking-wide">or continue with</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="py-2.5 px-4 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <GoogleIcon />
                <span className="text-sm">Google</span>
              </button>
              <button
                type="button"
                onClick={handleGithubLogin}
                className="py-2.5 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Github className="w-4 h-4" />
                <span className="text-sm">GitHub</span>
              </button>
            </div>

            {/* API Key Login Link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowApiKeyLogin(true)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign in with API Key instead
              </button>
            </div>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Organization Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                <>Create Account<ArrowRight size={18} /></>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400 uppercase tracking-wide">or sign up with</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="py-2.5 px-4 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <GoogleIcon />
                <span className="text-sm">Google</span>
              </button>
              <button
                type="button"
                onClick={handleGithubLogin}
                className="py-2.5 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Github className="w-4 h-4" />
                <span className="text-sm">GitHub</span>
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center pt-2">
              By signing up, you agree to our{' '}
              <a href="#" className="text-indigo-600 hover:underline">Terms</a>
              {' '}and{' '}
              <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>
            </p>
          </form>
        )}

        {/* Footer Links */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm">
          {mode === 'login' ? (
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setMode('register')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign up free
              </button>
            </p>
          ) : (
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign in
              </button>
            </p>
          )}
          <Link to="/" className="block mt-3 text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardLogin;
