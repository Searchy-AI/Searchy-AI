import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Database, Key, Search, TrendingUp, Plus, ArrowRight, 
  Activity, Clock, Zap, ChevronRight, X, Copy, CheckCircle
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Demo data for preview mode
const DEMO_INDICES = [
  {
    id: 'demo-idx-1',
    name: 'products',
    description: 'E-commerce product catalog',
    record_count: 1247,
    schema_fields: [
      { name: 'title', field_type: 'text', is_searchable: true },
      { name: 'description', field_type: 'text', is_searchable: true },
      { name: 'price', field_type: 'number', is_filterable: true },
      { name: 'category', field_type: 'enum', is_filterable: true },
      { name: 'image_url', field_type: 'image', is_searchable: true },
    ],
  },
  {
    id: 'demo-idx-2',
    name: 'articles',
    description: 'Knowledge base articles',
    record_count: 523,
    schema_fields: [
      { name: 'title', field_type: 'text', is_searchable: true },
      { name: 'content', field_type: 'text', is_searchable: true },
      { name: 'author', field_type: 'text', is_filterable: true },
      { name: 'published_at', field_type: 'date', is_filterable: true },
    ],
  },
];

const isDemoMode = (apiKey) => apiKey?.startsWith('sk_demo_');

// Welcome Modal for OAuth new accounts
const WelcomeModal = ({ apiKey, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome to Searchy!</h2>
          <p className="text-gray-600 mt-2">Your account has been created successfully.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium mb-2">⚠️ Save your API key - it won't be shown again!</p>
          <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm break-all">
            {apiKey}
          </code>
        </div>

        <button
          onClick={handleCopy}
          className="w-full mb-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy API Key'}
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, change, color = 'blue' }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between">
      <div className={`w-12 h-12 rounded-lg bg-${color}-50 flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-${color}-500`} />
      </div>
      {change && (
        <span className={`text-sm font-medium ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>
    <div className="mt-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, title, description, to }) => (
  <Link
    to={to}
    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
  >
    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
      <Icon className="w-5 h-5 text-indigo-500" />
    </div>
    <div className="flex-1">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
  </Link>
);

const RecentActivity = ({ activities }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-semibold text-gray-900">Recent Activity</h2>
      <Link to="/dashboard/analytics" className="text-sm text-blue-500 hover:text-blue-600">
        View All
      </Link>
    </div>
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No recent activity</p>
      ) : (
        activities.map((activity, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              activity.type === 'search' ? 'bg-blue-50' :
              activity.type === 'ingest' ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              {activity.type === 'search' ? (
                <Search className="w-4 h-4 text-blue-500" />
              ) : (
                <Database className="w-4 h-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{activity.description}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const DashboardOverview = () => {
  const { apiKey, tenant, oauthNewKey, clearOauthNewKey } = useDashboardAuth();
  const [stats, setStats] = useState({
    indices: 0,
    apiKeys: 0,
    searches: 0,
    records: 0,
  });
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Demo mode - use mock data
    if (isDemoMode(apiKey)) {
      setIndices(DEMO_INDICES);
      setStats({
        indices: DEMO_INDICES.length,
        apiKeys: 2,
        searches: 3842,
        records: DEMO_INDICES.reduce((acc, idx) => acc + idx.record_count, 0),
      });
      setLoading(false);
      return;
    }

    try {
      // Fetch indices
      const indicesRes = await fetch(`${API_BASE}/v1/indices`, {
        headers: { 'X-API-Key': apiKey },
      });
      const indicesData = await indicesRes.json();
      
      // Fetch API keys
      const keysRes = await fetch(`${API_BASE}/v1/api-keys`, {
        headers: { 'X-API-Key': apiKey },
      });
      const keysData = await keysRes.json();

      setIndices(indicesData.indices || []);
      setStats({
        indices: indicesData.indices?.length || 0,
        apiKeys: keysData?.length || 0,
        searches: 0, // Would come from analytics
        records: indicesData.indices?.reduce((acc, idx) => acc + (idx.record_count || 0), 0) || 0,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* OAuth Welcome Modal */}
      {oauthNewKey && (
        <WelcomeModal 
          apiKey={oauthNewKey} 
          onClose={clearOauthNewKey} 
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{tenant?.name ? `, ${tenant.name}` : ''}!
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your search infrastructure.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Database} label="Total Indices" value={stats.indices} color="blue" />
        <StatCard icon={Activity} label="Total Records" value={stats.records.toLocaleString()} color="green" />
        <StatCard icon={Search} label="Searches Today" value={stats.searches} color="purple" />
        <StatCard icon={Key} label="Active API Keys" value={stats.apiKeys} color="orange" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            icon={Plus}
            title="Create New Index"
            description="Set up a new search index with custom schema"
            to="/dashboard/indices/new"
          />
          <QuickAction
            icon={Key}
            title="Generate API Key"
            description="Create a new API key for your application"
            to="/dashboard/api-keys"
          />
          <QuickAction
            icon={Database}
            title="Import Data"
            description="Bulk import records from CSV or JSON"
            to="/dashboard/indices"
          />
          <QuickAction
            icon={Zap}
            title="Test Search"
            description="Try out semantic search on your data"
            to="/dashboard/playground"
          />
        </div>
      </div>

      {/* Indices List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Your Indices</h2>
          <Link 
            to="/dashboard/indices/new"
            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <Plus size={16} />
            New Index
          </Link>
        </div>
        
        {indices.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No indices yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first index to start searching</p>
            <Link
              to="/dashboard/indices/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={18} />
              Create Index
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {indices.map((index) => (
              <Link
                key={index.id}
                to={`/dashboard/indices/${index.name}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{index.name}</h3>
                    <p className="text-sm text-gray-500">
                      {index.record_count || 0} records • {index.schema_fields?.length || 0} fields
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
