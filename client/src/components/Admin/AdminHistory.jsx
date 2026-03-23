import React, { useEffect, useState } from 'react';
import { mergesAPI } from '../../services/api.js';
import { formatDate, downloadImage } from '../../utils/imageUtils.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import MergeCard from '../History/MergeCard.jsx';

export default function AdminHistory() {
  const [merges, setMerges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | completed | pending | failed
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMerges();
  }, []);

  async function loadMerges() {
    try {
      const data = await mergesAPI.list();
      setMerges(data.merges || []);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this merge permanently?')) return;
    try {
      await mergesAPI.delete(id);
      setMerges((prev) => prev.filter((m) => m.id !== id));
      toast.success('Merge deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  const filtered = merges.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const coupleName = `${m.couples?.person_a_name} ${m.couples?.person_b_name}`.toLowerCase();
      const templateName = (m.prompt_templates?.name || '').toLowerCase();
      return coupleName.includes(q) || templateName.includes(q);
    }
    return true;
  });

  const statusCounts = {
    all: merges.length,
    completed: merges.filter((m) => m.status === 'completed').length,
    pending: merges.filter((m) => m.status === 'pending').length,
    failed: merges.filter((m) => m.status === 'failed').length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Merge History</h1>
        <p className="text-slate-400 text-sm mt-1">{merges.length} total merge{merges.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg overflow-hidden border border-surface-border">
          {['all', 'completed', 'pending', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-primary-700 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-surface-border'
              }`}
            >
              {f} ({statusCounts[f]})
            </button>
          ))}
        </div>
        <input
          className="input-field max-w-xs py-1.5"
          placeholder="Search by name or template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400">No merges found</p>
          {search && (
            <button onClick={() => setSearch('')} className="text-primary-400 text-sm mt-2 hover:text-primary-300">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((merge) => (
            <MergeCard key={merge.id} merge={merge} onDelete={handleDelete} showDelete />
          ))}
        </div>
      )}
    </div>
  );
}
