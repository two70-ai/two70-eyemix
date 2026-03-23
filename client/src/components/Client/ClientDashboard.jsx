import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { clientAPI } from '../../services/api.js';
import { formatDate } from '../../utils/imageUtils.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [accessRecords, setAccessRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccess();
  }, []);

  async function loadAccess() {
    try {
      const data = await clientAPI.getAccess();
      setAccessRecords(data.access || []);
    } catch (err) {
      toast.error('Failed to load your couples');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
        </h1>
        <p className="text-slate-400 mt-2 text-sm sm:text-base">
          View your EyeMix results and product mockups below.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-primary-400">{accessRecords.length}</p>
          <p className="text-slate-400 text-sm mt-1">Your Couples</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-primary-400">
            {accessRecords.filter((a) => a.paywall_unlocked).length}
          </p>
          <p className="text-slate-400 text-sm mt-1">Unlocked</p>
        </div>
      </div>

      {/* Couples List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Your Couples</h2>
          <Link to="/client/couples" className="text-primary-400 text-sm hover:text-primary-300">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-surface-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : accessRecords.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-4xl mb-3">👁️</p>
            <p className="text-slate-400">No couples assigned to you yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              Your admin will assign couples once your EyeMix session is ready.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accessRecords.slice(0, 4).map((record, i) => {
              const couple = record.couples;
              if (!couple) return null;
              return (
                <motion.div
                  key={record.id || i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={`/client/results/${couple.id}`}
                    className="card p-4 block hover:border-primary-700 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-700/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                        {couple.person_a_name?.[0]}{couple.person_b_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-100 font-medium truncate">
                          {couple.person_a_name} & {couple.person_b_name}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {record.paywall_unlocked ? '✅ Unlocked' : '🔒 Locked'}
                        </p>
                      </div>
                      <span className="text-slate-500 group-hover:text-primary-400 transition-colors">→</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
