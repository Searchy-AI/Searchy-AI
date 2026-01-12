import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Database, Edit2, Trash2, Upload, Search, RefreshCw,
  FileJson, Activity, Clock, ChevronRight, Download, Copy, Check,
  Filter, Eye, Asterisk, Play, AlertCircle
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const IndexDetails = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { apiKey } = useDashboardAuth();
  
  const [index, setIndex] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schema');
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchIndex();
    fetchRecords();
  }, [name]);

  const fetchIndex = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/indices/${name}`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (!res.ok) throw new Error('Failed to fetch index');
      const data = await res.json();
      setIndex(data);
    } catch (err) {
      console.error('Failed to fetch index:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/indices/${name}/records?limit=10`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to fetch records:', err);
    }
  };

  const handleTestSearch = async () => {
    if (!testQuery.trim()) return;
    
    setSearching(true);
    setTestResults(null);
    
    try {
      const res = await fetch(`${API_BASE}/v1/indices/${name}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ query: testQuery, limit: 5 }),
      });
      
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleReindex = async () => {
    try {
      await fetch(`${API_BASE}/v1/indices/${name}/records/reindex`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });
      alert('Reindexing started!');
    } catch (err) {
      console.error('Reindex failed:', err);
    }
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(`${API_BASE}/v1/indices/${name}/search`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!index) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Index Not Found</h2>
        <p className="text-gray-500 mb-4">The index "{name}" doesn't exist or you don't have access.</p>
        <Link to="/dashboard/indices" className="text-blue-500 hover:text-blue-600">
          ← Back to Indices
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/dashboard/indices"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{index.name}</h1>
              <p className="text-gray-500">{index.description || 'No description'}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReindex}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reindex
          </button>
          <Link
            to={`/dashboard/indices/${name}/edit`}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit Schema
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Total Records</p>
          <p className="text-2xl font-bold text-gray-900">{index.record_count || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Schema Fields</p>
          <p className="text-2xl font-bold text-gray-900">{index.schema_fields?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Namespace</p>
          <p className="text-sm font-mono text-gray-700 truncate">{index.namespace}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Created</p>
          <p className="text-sm text-gray-700">{new Date(index.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* API Endpoint */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">Search Endpoint</p>
          <code className="text-sm font-mono text-gray-800">{`POST ${API_BASE}/v1/indices/${name}/search`}</code>
        </div>
        <button
          onClick={copyEndpoint}
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          {['schema', 'records', 'test'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'schema' && 'Schema'}
              {tab === 'records' && 'Records'}
              {tab === 'test' && 'Test Search'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'schema' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Searchable</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Filterable</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Displayable</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {index.schema_fields?.map((field, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{field.name}</span>
                    {field.description && (
                      <p className="text-xs text-gray-500">{field.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {field.field_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {field.is_searchable && <Search className="w-4 h-4 text-blue-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {field.is_filterable && <Filter className="w-4 h-4 text-purple-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {field.is_displayable && <Eye className="w-4 h-4 text-green-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {field.is_required && <Asterisk className="w-4 h-4 text-red-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'records' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Showing first 10 records</p>
            <Link
              to={`/dashboard/indices/${name}/import`}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Import Data
            </Link>
          </div>
          
          {records.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
              <FileJson className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">No records yet</h3>
              <p className="text-sm text-gray-500 mb-4">Import data to start searching</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      {index.schema_fields?.slice(0, 4).map((field) => (
                        <th key={field.name} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {field.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {record.external_id?.slice(0, 8)}...
                        </td>
                        {index.schema_fields?.slice(0, 4).map((field) => (
                          <td key={field.name} className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                            {String(record.data?.[field.name] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'test' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-medium text-gray-900 mb-4">Test Semantic Search</h3>
          
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
              placeholder="Enter a search query..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleTestSearch}
              disabled={searching || !testQuery.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {searching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Search
            </button>
          </div>

          {testResults && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Found {testResults.results?.length || 0} results in {testResults.latency_ms}ms
              </p>
              <div className="space-y-3">
                {testResults.results?.map((result, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Score: {result.score?.toFixed(3)}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {result.id}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IndexDetails;
