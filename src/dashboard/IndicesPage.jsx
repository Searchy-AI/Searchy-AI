import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, Plus, Search, MoreVertical, Trash2, Edit2,
  ArrowRight, FileJson, Upload, RefreshCw, Activity
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Demo data
const DEMO_INDICES = [
  {
    id: 'demo-idx-1',
    name: 'products',
    description: 'E-commerce product catalog with images and prices',
    record_count: 1247,
    schema_fields: [
      { name: 'title', field_type: 'text' },
      { name: 'description', field_type: 'text' },
      { name: 'price', field_type: 'number' },
      { name: 'category', field_type: 'enum' },
      { name: 'image_url', field_type: 'image' },
    ],
  },
  {
    id: 'demo-idx-2',
    name: 'articles',
    description: 'Knowledge base and documentation',
    record_count: 523,
    schema_fields: [
      { name: 'title', field_type: 'text' },
      { name: 'content', field_type: 'text' },
      { name: 'author', field_type: 'text' },
      { name: 'published_at', field_type: 'date' },
    ],
  },
  {
    id: 'demo-idx-3',
    name: 'users',
    description: 'User profiles for people search',
    record_count: 89,
    schema_fields: [
      { name: 'name', field_type: 'text' },
      { name: 'bio', field_type: 'text' },
      { name: 'location', field_type: 'geo' },
    ],
  },
];

const isDemoMode = (apiKey) => apiKey?.startsWith('sk_demo_');

const IndicesPage = () => {
  const { apiKey } = useDashboardAuth();
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);

  useEffect(() => {
    fetchIndices();
  }, []);

  const fetchIndices = async () => {
    // Demo mode
    if (isDemoMode(apiKey)) {
      setIndices(DEMO_INDICES);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/v1/indices`, {
        headers: { 'X-API-Key': apiKey },
      });
      const data = await res.json();
      setIndices(data.indices || []);
    } catch (err) {
      console.error('Failed to fetch indices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (indexName) => {
    if (isDemoMode(apiKey)) {
      alert('Demo mode: Delete is disabled');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${indexName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await fetch(`${API_BASE}/v1/indices/${indexName}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });
      setIndices(indices.filter(i => i.name !== indexName));
    } catch (err) {
      console.error('Failed to delete index:', err);
    }
    setMenuOpen(null);
  };

  const filteredIndices = indices.filter(idx =>
    idx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idx.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Indices</h1>
          <p className="text-gray-500">Manage your search indices and schemas</p>
        </div>
        <Link
          to="/dashboard/indices/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          New Index
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search indices..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Indices Grid */}
      {filteredIndices.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 text-lg mb-2">
            {searchTerm ? 'No matching indices' : 'No indices yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm ? 'Try a different search term' : 'Create your first index to start building your search infrastructure'}
          </p>
          {!searchTerm && (
            <Link
              to="/dashboard/indices/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} />
              Create Your First Index
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIndices.map((index) => (
            <div
              key={index.id}
              className="bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === index.name ? null : index.name)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    {menuOpen === index.name && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 w-40 z-10">
                        <Link
                          to={`/dashboard/indices/${index.name}/edit`}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Schema
                        </Link>
                        <button
                          onClick={() => handleDelete(index.name)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 w-full"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-1">{index.name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {index.description || 'No description'}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <FileJson className="w-4 h-4" />
                    {index.schema_fields?.length || 0} fields
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    {index.record_count || 0} records
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    to={`/dashboard/indices/${index.name}`}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View Details
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/dashboard/indices/${index.name}/import`}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Import Data"
                  >
                    <Upload className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IndicesPage;
