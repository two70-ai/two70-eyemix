import React, { useEffect, useState } from 'react';
import { templatesAPI } from '../../services/api.js';
import TemplateCard from './TemplateCard.jsx';
import toast from 'react-hot-toast';

export default function TemplateGallery({ selectedTemplate, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await templatesAPI.list();
        setTemplates((data.templates || []).filter((t) => t.is_active));
      } catch (err) {
        toast.error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = ['all', ...new Set(templates.map((t) => t.category))];

  const filtered = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-52 bg-surface-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No templates available. Ask admin to create some!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                categoryFilter === cat
                  ? 'bg-primary-700 text-white'
                  : 'bg-surface-card text-slate-400 hover:text-slate-100 border border-surface-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplate?.id === template.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {selectedTemplate && (
        <div className="mt-4 p-3 rounded-lg bg-primary-900/20 border border-primary-700/40">
          <p className="text-sm text-primary-300">
            <span className="font-semibold">Selected:</span> {selectedTemplate.name}
          </p>
          {selectedTemplate.description && (
            <p className="text-xs text-slate-400 mt-1">{selectedTemplate.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
