import React, { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Shield,
  AlertTriangle, Clock, MoreVertical, AlertCircle, X
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Demo data
const DEMO_KEYS = [
  {
    id: 'demo-key-1',
    name: 'Production API',
    key_prefix: 'sk_live_',
    key_hint: 'Xk8s',
    is_test: false,
    is_active: true,
    created_at: '2025-12-01T10:00:00Z',
    last_used_at: '2026-01-12T14:30:00Z',
  },
  {
    id: 'demo-key-2',
    name: 'Development',
    key_prefix: 'sk_test_',
    key_hint: '9pQr',
    is_test: true,
    is_active: true,
    created_at: '2025-12-15T09:00:00Z',
    last_used_at: '2026-01-11T16:45:00Z',
  },
];

const isDemoMode = (apiKey) => apiKey?.startsWith('sk_demo_');

const APIKeysPage = () => {
  const { apiKey } = useDashboardAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', is_test: false });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    // Demo mode
    if (isDemoMode(apiKey)) {
      setKeys(DEMO_KEYS);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        headers: { 'X-API-Key': apiKey },
      });
      const data = await res.json();
      setKeys(data || []);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    
    // Demo mode
    if (isDemoMode(apiKey)) {
      setNewKey('sk_demo_example_key_would_appear_here');
      return;
    }
    
    setCreating(true);
    
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail?.message || 'Failed to create API key');
      }
      
      const data = await res.json();
      setNewKey(data.api_key);
      fetchKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId, keyName) => {
    if (!confirm(`Are you sure you want to revoke "${keyName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await fetch(`${API_BASE}/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });
      setKeys(keys.filter(k => k.id !== keyId));
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyToClipboard = (text, keyId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewKey(null);
    setFormData({ name: '', is_test: false });
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500">Manage your API keys for authentication</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Create API Key
        </button>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800">Keep your API keys secure</h3>
          <p className="text-sm text-amber-700">
            Never share your API keys in public repositories or client-side code. 
            Use environment variables to store them securely.
          </p>
        </div>
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 text-lg mb-2">No API keys yet</h3>
          <p className="text-gray-500 mb-6">Create your first API key to authenticate API requests</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={20} />
            Create API Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        key.is_test ? 'bg-orange-100' : 'bg-green-100'
                      }`}>
                        <Key className={`w-4 h-4 ${key.is_test ? 'text-orange-500' : 'text-green-500'}`} />
                      </div>
                      <span className="font-medium text-gray-900">{key.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                        {key.key_prefix}...{key.key_hint}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`${key.key_prefix}...${key.key_hint}`, key.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Copy key hint"
                      >
                        {copiedKey === key.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      key.is_test 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {key.is_test ? 'Test' : 'Live'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {key.last_used_at 
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      key.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${key.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {key.is_active && (
                      <button
                        onClick={() => handleRevoke(key.id, key.name)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {newKey ? 'API Key Created!' : 'Create API Key'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {newKey ? (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      Make sure to copy your API key now. You won't be able to see it again!
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-2">Your API Key</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-900 text-green-400 p-3 rounded text-sm break-all">
                        {newKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newKey, 'new')}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {copiedKey === 'new' ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate}>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Production API, Dev Testing"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Key Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_test: false })}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          !formData.is_test
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className={`w-5 h-5 ${!formData.is_test ? 'text-green-500' : 'text-gray-400'}`} />
                          <span className={`font-medium ${!formData.is_test ? 'text-green-700' : 'text-gray-700'}`}>
                            Live
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">For production use</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_test: true })}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          formData.is_test
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className={`w-5 h-5 ${formData.is_test ? 'text-orange-500' : 'text-gray-400'}`} />
                          <span className={`font-medium ${formData.is_test ? 'text-orange-700' : 'text-gray-700'}`}>
                            Test
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">For development</p>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !formData.name}
                      className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4" />
                          Create Key
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIKeysPage;
