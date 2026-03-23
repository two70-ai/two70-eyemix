import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { templatesAPI } from '../../services/api.js';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/imageUtils.js';

const CATEGORIES = ['Nature', 'Galaxy', 'Geometric', 'Floral', 'Abstract', 'Mystical', 'Watercolor', 'Other'];

function TemplateForm({ template, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    prompt_text: template?.prompt_text || '',
    category: template?.category || CATEGORIES[0],
    is_active: template?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.prompt_text) {
      toast.error('Name and prompt text are required');
      return;
    }
    setLoading(true);
    try {
      let data;
      if (template?.id) {
        data = await templatesAPI.update(template.id, form);
        toast.success('Template updated!');
      } else {
        data = await templatesAPI.create(form);
        toast.success('Template created!');
      }
      onSave(data.template);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
          <input name="name" className="input-field" value={form.name} onChange={handleChange} placeholder="Galaxy Merge" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select name="category" className="input-field" value={form.category} onChange={handleChange}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
        <input name="description" className="input-field" value={form.description} onChange={handleChange} placeholder="Brief description of this style" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Prompt Text
          <span className="ml-2 text-xs text-slate-500">(The generic iris prefix is added automatically)</span>
        </label>
        <textarea
          name="prompt_text"
          className="input-field min-h-28 resize-y"
          value={form.prompt_text}
          onChange={handleChange}
          placeholder="Merge the two irises into a cosmic galaxy pattern with swirling nebulae, stars, and deep space colors radiating from the merged pupils..."
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          name="is_active"
          checked={form.is_active}
          onChange={handleChange}
          className="w-4 h-4 rounded accent-primary-600"
        />
        <label htmlFor="is_active" className="text-sm text-slate-300">Active (visible to clients)</label>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Saving...' : template?.id ? 'Update Template' : 'Create Template'}
        </button>
      </div>
    </form>
  );
}

function TemplateRow({ template, onEdit, onDelete, onGenerateReference }) {
  const [generatingRef, setGeneratingRef] = useState(false);

  const handleGenerateRef = async () => {
    setGeneratingRef(true);
    try {
      const data = await onGenerateReference(template.id);
      toast.success('Reference image generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate reference');
    } finally {
      setGeneratingRef(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col sm:flex-row gap-4 hover:border-primary-700/40 transition-colors"
    >
      {/* Reference image */}
      <div className="w-full sm:w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-border">
        {template.reference_image_url ? (
          <img src={template.reference_image_url} alt="Reference" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2 mb-1">
          <h3 className="font-semibold text-slate-100">{template.name}</h3>
          <span className="badge bg-primary-900/30 text-primary-300">{template.category}</span>
          {!template.is_active && <span className="badge bg-slate-700 text-slate-400">Inactive</span>}
        </div>
        <p className="text-sm text-slate-400 line-clamp-2">{template.description}</p>
        <p className="text-xs text-slate-600 mt-1">{formatDate(template.created_at)}</p>
      </div>

      <div className="flex flex-row sm:flex-col gap-2 justify-end">
        <button
          onClick={handleGenerateRef}
          disabled={generatingRef}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          title="Generate reference image"
        >
          {generatingRef ? (
            <div className="w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01" />
            </svg>
          )}
          Ref Image
        </button>
        <button onClick={() => onEdit(template)} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
        <button onClick={() => onDelete(template.id)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
      </div>
    </motion.div>
  );
}

export default function TemplateManagement() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await templatesAPI.list();
      setTemplates(data.templates || []);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this template?')) return;
    try {
      await templatesAPI.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  async function handleGenerateReference(id) {
    const data = await templatesAPI.generateReference(id);
    setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)));
    return data;
  }

  function handleFormSave(template) {
    if (editingTemplate) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
    } else {
      setTemplates((prev) => [template, ...prev]);
    }
    setShowForm(false);
    setEditingTemplate(null);
  }

  function handleEdit(template) {
    setEditingTemplate(template);
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingTemplate(null);
    setShowForm(true);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Prompt Templates</h1>
          <p className="text-slate-400 text-sm mt-1">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Template
          </button>
        )}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card border-primary-700/50"
          >
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h2>
            <TemplateForm
              template={editingTemplate}
              onSave={handleFormSave}
              onCancel={() => { setShowForm(false); setEditingTemplate(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400">No templates yet</p>
          <p className="text-slate-500 text-sm mt-1">Create your first prompt template to start generating iris art</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerateReference={handleGenerateReference}
            />
          ))}
        </div>
      )}
    </div>
  );
}
