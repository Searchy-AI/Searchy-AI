import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Database, Plus, Trash2, GripVertical, Save, ArrowLeft,
  Type, Hash, Calendar, Image, MapPin, Link as LinkIcon,
  ToggleLeft, List, AlertCircle, CheckCircle, X, Search,
  Filter, Eye, Asterisk, ChevronDown, Settings
} from 'lucide-react';
import { useDashboardAuth } from './DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'String values, searchable' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric values, filterable' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date/time values' },
  { value: 'image', label: 'Image URL', icon: Image, description: 'Image URLs for visual search' },
  { value: 'url', label: 'URL', icon: LinkIcon, description: 'Web links' },
  { value: 'boolean', label: 'Boolean', icon: ToggleLeft, description: 'True/false values' },
  { value: 'enum', label: 'Enum', icon: List, description: 'Predefined set of values' },
  { value: 'geo', label: 'Geo Location', icon: MapPin, description: 'Lat/lng coordinates' },
  { value: 'id', label: 'ID', icon: Hash, description: 'Unique identifier' },
];

const FieldTypeIcon = ({ type, className = 'w-5 h-5' }) => {
  const fieldType = FIELD_TYPES.find(t => t.value === type);
  const Icon = fieldType?.icon || Type;
  return <Icon className={className} />;
};

const FieldRow = ({ field, index, onUpdate, onDelete, isNew }) => {
  const [expanded, setExpanded] = useState(isNew);

  return (
    <div className={`border rounded-lg ${expanded ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'} transition-all`}>
      {/* Collapsed View */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
        
        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
          <FieldTypeIcon type={field.field_type} className="w-4 h-4 text-gray-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{field.name || 'Untitled Field'}</span>
            {field.is_required && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{field.field_type}</span>
            {field.is_searchable && (
              <span className="text-xs text-blue-500 flex items-center gap-0.5">
                <Search className="w-3 h-3" /> Searchable
              </span>
            )}
            {field.is_filterable && (
              <span className="text-xs text-purple-500 flex items-center gap-0.5">
                <Filter className="w-3 h-3" /> Filterable
              </span>
            )}
          </div>
        </div>
        
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 mt-2 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Field Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
              <input
                type="text"
                value={field.name}
                onChange={(e) => onUpdate(index, { ...field, name: e.target.value })}
                placeholder="e.g., title, description, price"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
              <select
                value={field.field_type}
                onChange={(e) => onUpdate(index, { ...field, field_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={field.description || ''}
              onChange={(e) => onUpdate(index, { ...field, description: e.target.value })}
              placeholder="Describe what this field contains"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Enum Values (if enum type) */}
          {field.field_type === 'enum' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Values</label>
              <input
                type="text"
                value={field.enum_values?.join(', ') || ''}
                onChange={(e) => onUpdate(index, { 
                  ...field, 
                  enum_values: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                })}
                placeholder="value1, value2, value3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed values</p>
            </div>
          )}

          {/* Number Range (if number type) */}
          {field.field_type === 'number' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                <input
                  type="number"
                  value={field.min_value ?? ''}
                  onChange={(e) => onUpdate(index, { ...field, min_value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="No minimum"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                <input
                  type="number"
                  value={field.max_value ?? ''}
                  onChange={(e) => onUpdate(index, { ...field, max_value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="No maximum"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* Field Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.is_searchable}
                onChange={(e) => onUpdate(index, { ...field, is_searchable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700">Searchable</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.is_filterable}
                onChange={(e) => onUpdate(index, { ...field, is_filterable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
              />
              <Filter className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-700">Filterable</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.is_displayable}
                onChange={(e) => onUpdate(index, { ...field, is_displayable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
              />
              <Eye className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700">Show in Results</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.is_required}
                onChange={(e) => onUpdate(index, { ...field, is_required: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
              />
              <Asterisk className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-700">Required</span>
            </label>
          </div>

          {/* Delete Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onDelete(index)}
              className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">Remove Field</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SchemaBuilder = () => {
  const { name } = useParams(); // For editing existing index
  const navigate = useNavigate();
  const { apiKey } = useDashboardAuth();
  
  const isEditing = Boolean(name);
  
  const [indexName, setIndexName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isEditing) {
      fetchIndex();
    }
  }, [name]);

  const fetchIndex = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/indices/${name}`, {
        headers: { 'X-API-Key': apiKey },
      });
      
      if (!res.ok) throw new Error('Failed to fetch index');
      
      const data = await res.json();
      setIndexName(data.name);
      setDescription(data.description || '');
      setFields(data.schema_fields || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        name: '',
        field_type: 'text',
        description: '',
        is_searchable: true,
        is_filterable: false,
        is_displayable: true,
        is_required: false,
        enum_values: null,
        min_value: null,
        max_value: null,
        _isNew: true,
      },
    ]);
  };

  const updateField = (index, updatedField) => {
    const newFields = [...fields];
    newFields[index] = updatedField;
    setFields(newFields);
  };

  const deleteField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const validateSchema = () => {
    if (!indexName.trim()) {
      setError('Index name is required');
      return false;
    }
    
    if (!/^[a-z0-9_-]+$/.test(indexName)) {
      setError('Index name can only contain lowercase letters, numbers, hyphens, and underscores');
      return false;
    }
    
    if (fields.length === 0) {
      setError('At least one field is required');
      return false;
    }
    
    for (const field of fields) {
      if (!field.name.trim()) {
        setError('All fields must have a name');
        return false;
      }
      if (!/^[a-z0-9_]+$/.test(field.name)) {
        setError(`Field "${field.name}" can only contain lowercase letters, numbers, and underscores`);
        return false;
      }
    }
    
    // Check for duplicate field names
    const names = fields.map(f => f.name);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      setError(`Duplicate field name: ${duplicates[0]}`);
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    
    if (!validateSchema()) return;
    
    setSaving(true);
    
    try {
      const payload = {
        name: indexName,
        description: description || null,
        schema_fields: fields.map(({ _isNew, ...field }) => ({
          name: field.name,
          field_type: field.field_type,
          description: field.description || null,
          is_searchable: field.is_searchable,
          is_filterable: field.is_filterable,
          is_displayable: field.is_displayable,
          is_required: field.is_required,
          enum_values: field.enum_values,
          min_value: field.min_value,
          max_value: field.max_value,
        })),
      };

      const url = isEditing 
        ? `${API_BASE}/v1/indices/${name}/schema`
        : `${API_BASE}/v1/indices`;
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail?.message || 'Failed to save index');
      }

      setSuccess(isEditing ? 'Schema updated successfully!' : 'Index created successfully!');
      
      // Navigate to index details after a short delay
      setTimeout(() => {
        navigate(`/dashboard/indices/${indexName}`);
      }, 1500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/dashboard/indices"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Schema' : 'Create New Index'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Update your index schema configuration' : 'Define the structure of your search index'}
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Index Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Index Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Index Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="e.g., products, articles, users"
              disabled={isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">Lowercase, no spaces. Used in API endpoints.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What data does this index contain?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Schema Fields */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Schema Fields
          </h2>
          <button
            onClick={addField}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No fields defined</h3>
            <p className="text-sm text-gray-500 mb-4">Add fields to define your index schema</p>
            <button
              onClick={addField}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={18} />
              Add First Field
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <FieldRow
                key={index}
                field={field}
                index={index}
                onUpdate={updateField}
                onDelete={deleteField}
                isNew={field._isNew}
              />
            ))}
          </div>
        )}

        {/* Field Legend */}
        {fields.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Field Options:</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Search className="w-3 h-3 text-blue-500" />
                Searchable: Included in semantic search embedding
              </span>
              <span className="flex items-center gap-1">
                <Filter className="w-3 h-3 text-purple-500" />
                Filterable: Can be used in filter queries
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-green-500" />
                Displayable: Returned in search results
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 mt-6">
        <Link
          to="/dashboard/indices"
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update Schema' : 'Create Index'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SchemaBuilder;
