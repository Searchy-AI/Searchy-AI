import React, { useState, useEffect } from 'react';
import {
  Webhook, Plus, Trash2, Edit2, Check, X, AlertCircle,
  Play, Pause, RefreshCw, Clock, ExternalLink, Copy, Filter
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const WEBHOOK_EVENTS = [
  { value: 'record.created', label: 'Record Created', description: 'When a new record is ingested' },
  { value: 'record.updated', label: 'Record Updated', description: 'When a record is modified' },
  { value: 'record.deleted', label: 'Record Deleted', description: 'When a record is removed' },
  { value: 'index.created', label: 'Index Created', description: 'When a new index is created' },
  { value: 'index.deleted', label: 'Index Deleted', description: 'When an index is deleted' },
  { value: 'search.executed', label: 'Search Executed', description: 'When a search query is run' },
];

const WebhooksPage = () => {
  const { apiKey } = useDashboardAuth();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [],
    secret: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/webhooks`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingWebhook 
        ? `${API_BASE}/v1/webhooks/${editingWebhook.id}`
        : `${API_BASE}/v1/webhooks`;
      
      const res = await fetch(url, {
        method: editingWebhook ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail?.message || 'Failed to save webhook');
      }

      fetchWebhooks();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (webhookId, webhookName) => {
    if (!confirm(`Are you sure you want to delete "${webhookName}"?`)) return;
    
    try {
      await fetch(`${API_BASE}/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });
      setWebhooks(webhooks.filter(w => w.id !== webhookId));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleToggle = async (webhook) => {
    try {
      await fetch(`${API_BASE}/v1/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ ...webhook, is_active: !webhook.is_active }),
      });
      setWebhooks(webhooks.map(w => 
        w.id === webhook.id ? { ...w, is_active: !w.is_active } : w
      ));
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  };

  const handleTest = async (webhook) => {
    setTestingWebhook(webhook.id);
    try {
      await fetch(`${API_BASE}/v1/webhooks/${webhook.id}/test`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
      });
      alert('Test webhook sent successfully!');
    } catch (err) {
      console.error('Failed to test webhook:', err);
      alert('Failed to send test webhook');
    } finally {
      setTestingWebhook(null);
    }
  };

  const openModal = (webhook = null) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events || [],
        secret: '',
        is_active: webhook.is_active,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        name: '',
        url: '',
        events: [],
        secret: '',
        is_active: true,
      });
    }
    setShowModal(true);
    setError('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWebhook(null);
    setFormData({ name: '', url: '', events: [], secret: '', is_active: true });
    setError('');
  };

  const toggleEvent = (eventValue) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue]
    }));
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
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-gray-500">Receive real-time notifications for events</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Add Webhook
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-medium text-blue-800 mb-1">How Webhooks Work</h3>
        <p className="text-sm text-blue-700">
          Webhooks send HTTP POST requests to your specified URL when events occur. 
          You can verify authenticity using the signature header with your secret.
        </p>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <Webhook className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 text-lg mb-2">No webhooks configured</h3>
          <p className="text-gray-500 mb-6">
            Set up webhooks to receive real-time notifications about your search events
          </p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={20} />
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    webhook.is_active ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <Webhook className={`w-6 h-6 ${webhook.is_active ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        webhook.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {webhook.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-mono mb-2">{webhook.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events?.map(event => (
                        <span
                          key={event}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(webhook)}
                    disabled={testingWebhook === webhook.id}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    title="Send test webhook"
                  >
                    {testingWebhook === webhook.id ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(webhook)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    title={webhook.is_active ? 'Pause webhook' : 'Activate webhook'}
                  >
                    {webhook.is_active ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openModal(webhook)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    title="Edit webhook"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id, webhook.name)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                    title="Delete webhook"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              {webhook.last_triggered_at && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                  </span>
                  <span>
                    Success rate: {webhook.success_count || 0}/{(webhook.success_count || 0) + (webhook.failure_count || 0)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Production Sync"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://your-server.com/webhook"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    placeholder="Used to sign webhook payloads"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If set, payloads will include a signature header
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events to Subscribe
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {WEBHOOK_EVENTS.map(event => (
                      <label
                        key={event.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formData.events.includes(event.value)
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.value)}
                          onChange={() => toggleEvent(event.value)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{event.label}</p>
                          <p className="text-xs text-gray-500">{event.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.name || !formData.url || formData.events.length === 0}
                    className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingWebhook ? 'Update' : 'Create'} Webhook
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhooksPage;
