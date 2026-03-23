import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientAPI } from '../../services/api.js';
import { formatDate } from '../../utils/imageUtils.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ClientCouples() {
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
      toast.error('Failed to load couples');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Your Couples</h1>
        <p className="text-slate-400 text-sm mt-1">
          {accessRecords.length} couple{accessRecords.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : accessRecords.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">👁️</p>
          <p className="text-slate-400">No couples assigned yet.</p>
          <p className="text-slate-500 text-sm mt-1">Check back once your admin has set up your EyeMix session.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessRecords.map((record, i) => {
            const couple = record.couples;
            if (!couple) return null;
            return (
              <motion.div
                key={record.id || i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/client/results/${couple.id}`}
                  className="card p-5 block hover:border-primary-700 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary-700/20 flex items-center justify-center text-primary-400 font-bold shrink-0">
                      {couple.person_a_name?.[0]}{couple.person_b_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-100 font-semibold truncate">
                        {couple.person_a_name} & {couple.person_b_name}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Created {formatDate(couple.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        record.paywall_unlocked
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {record.paywall_unlocked ? '✅ Unlocked' : '🔒 Locked'}
                    </span>
                    <span className="text-slate-500 text-sm group-hover:text-primary-400 transition-colors">
                      View →
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
