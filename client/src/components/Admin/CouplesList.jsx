import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { couplesAPI, authAPI } from '../../services/api.js';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/imageUtils.js';

function CreateCoupleModal({ onClose, onCreated }) {
  const [personA, setPersonA] = useState('');
  const [personB, setPersonB] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!personA.trim() || !personB.trim()) {
      toast.error('Both names are required');
      return;
    }
    setLoading(true);
    try {
      const data = await couplesAPI.create({
        person_a_name: personA.trim(),
        person_b_name: personB.trim(),
      });
      toast.success('Couple created!');
      onCreated(data.couple);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create couple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">Add Couple</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Person A Name</label>
            <input
              className="input-field"
              value={personA}
              onChange={(e) => setPersonA(e.target.value)}
              placeholder="e.g. Alice"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Person B Name</label>
            <input
              className="input-field"
              value={personB}
              onChange={(e) => setPersonB(e.target.value)}
              placeholder="e.g. Bob"
              disabled={loading}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating...
                </span>
              ) : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function CouplesList() {
  const [couples, setCouples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadCouples();
  }, []);

  async function loadCouples() {
    try {
      const data = await couplesAPI.list();
      setCouples(data.couples || []);
    } catch (err) {
      toast.error('Failed to load couples');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this couple and all their merges?')) return;
    setDeletingId(id);
    try {
      await couplesAPI.delete(id);
      setCouples((prev) => prev.filter((c) => c.id !== id));
      toast.success('Couple deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Couples</h1>
          <p className="text-slate-400 text-sm mt-1">{couples.length} couple{couples.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Couple
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : couples.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-slate-400">No couples yet</p>
          <p className="text-slate-500 text-sm mt-1">Add your first couple to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {couples.map((couple) => (
            <motion.div
              key={couple.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="card flex items-center gap-4 hover:border-primary-700/40 transition-colors"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {couple.person_a_name[0]}{couple.person_b_name[0]}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100">
                  {couple.person_a_name} & {couple.person_b_name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Created {formatDate(couple.created_at)}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(couple.id)}
                  disabled={deletingId === couple.id}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete couple"
                >
                  {deletingId === couple.id ? (
                    <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateCoupleModal
            onClose={() => setShowCreate(false)}
            onCreated={(couple) => setCouples((prev) => [couple, ...prev])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
