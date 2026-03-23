import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clientAPI } from '../../services/api.js';
import { formatDate, downloadImage } from '../../utils/imageUtils.js';
import MockupGallery from '../ProductMockups/MockupGallery.jsx';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ClientResults() {
  const { mergeId: coupleId } = useParams(); // Route param is :mergeId but it's actually coupleId
  const [merges, setMerges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [selectedMerge, setSelectedMerge] = useState(null);

  useEffect(() => {
    loadResults();
  }, [coupleId]);

  async function loadResults() {
    try {
      const data = await clientAPI.getMerges(coupleId);
      setMerges(data.merges || []);
      setLocked(false);
    } catch (err) {
      if (err.response?.status === 402 || err.response?.data?.requiresUnlock) {
        setLocked(true);
      } else if (err.response?.status === 403) {
        toast.error('You do not have access to this couple');
      } else {
        toast.error('Failed to load results');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setUnlocking(true);
    try {
      await clientAPI.unlock(password, coupleId);
      toast.success('Access unlocked! 🎉');
      setLocked(false);
      setPassword('');
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Incorrect password');
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">
        <div className="h-8 w-48 bg-surface-card rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Paywall screen
  if (locked) {
    return (
      <div className="max-w-md mx-auto mt-12 animate-slide-up">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Results Locked</h2>
          <p className="text-slate-400 text-sm mb-6">
            Enter the access password provided by your photographer to view your EyeMix results.
          </p>

          {/* Blurred preview teaser */}
          <div className="relative mb-6 rounded-xl overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-primary-700/30 to-purple-600/30 flex items-center justify-center">
              <div className="blur-lg text-6xl">👁️✨👁️</div>
            </div>
            <div className="absolute inset-0 backdrop-blur-md bg-surface-card/50 flex items-center justify-center">
              <p className="text-slate-300 font-medium">Your beautiful results await...</p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              className="input-field w-full text-center"
              placeholder="Enter access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={unlocking || !password.trim()}
              className="btn-primary w-full"
            >
              {unlocking ? 'Unlocking...' : 'Unlock Results'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <Link to="/client/couples" className="text-slate-400 hover:text-slate-200 transition-colors">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">Your Results</h1>
      </div>

      {merges.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">✨</p>
          <p className="text-slate-400">No completed merges yet.</p>
          <p className="text-slate-500 text-sm mt-1">Your results will appear here once they're ready.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Merge selector if multiple */}
          {merges.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {merges.map((merge, i) => (
                <button
                  key={merge.id}
                  onClick={() => setSelectedMerge(merge)}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (selectedMerge?.id || merges[0].id) === merge.id
                      ? 'bg-primary-700 text-white'
                      : 'bg-surface-card text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {merge.prompt_templates?.name || `Merge ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Active merge display */}
          {(() => {
            const activeMerge = selectedMerge || merges[0];
            return (
              <motion.div
                key={activeMerge.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Main result image */}
                <div className="card p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">
                        {activeMerge.prompt_templates?.name || 'EyeMix Result'}
                      </h3>
                      <p className="text-slate-500 text-sm">{formatDate(activeMerge.created_at)}</p>
                    </div>
                    {activeMerge.result_url && (
                      <button
                        onClick={() => downloadImage(activeMerge.result_url, `eyemix-${activeMerge.id}.png`)}
                        className="btn-secondary text-sm"
                      >
                        ⬇ Download
                      </button>
                    )}
                  </div>

                  {activeMerge.result_url ? (
                    <img
                      src={activeMerge.result_url}
                      alt="EyeMix Result"
                      className="w-full max-h-[500px] object-contain rounded-lg"
                    />
                  ) : (
                    <div className="h-64 bg-surface-border rounded-lg flex items-center justify-center text-slate-500">
                      No result image available
                    </div>
                  )}
                </div>

                {/* Product Mockups */}
                {activeMerge.result_url && (
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Product Mockups</h3>
                    <MockupGallery imageUrl={activeMerge.result_url} />
                  </div>
                )}
              </motion.div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
