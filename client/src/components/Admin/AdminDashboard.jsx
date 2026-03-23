import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { couplesAPI, mergesAPI, templatesAPI } from '../../services/api.js';
import { formatDate } from '../../utils/imageUtils.js';

function StatCard({ title, value, icon, color, to }) {
  const content = (
    <div className={`card hover:border-${color}-700/50 transition-all duration-300 hover:shadow-glow cursor-pointer group`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-${color}-900/40 flex items-center justify-center text-${color}-400`}>
          {icon}
        </div>
        {to && (
          <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-100 mb-1">{value ?? '—'}</p>
      <p className="text-sm text-slate-400">{title}</p>
    </div>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ couples: null, merges: null, templates: null });
  const [recentMerges, setRecentMerges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [couplesData, mergesData, templatesData] = await Promise.all([
          couplesAPI.list(),
          mergesAPI.list(),
          templatesAPI.list(),
        ]);
        setStats({
          couples: couplesData.couples?.length ?? 0,
          merges: mergesData.merges?.length ?? 0,
          templates: templatesData.templates?.length ?? 0,
        });
        setRecentMerges((mergesData.merges || []).slice(0, 5));
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColors = {
    completed: 'text-green-400 bg-green-900/30',
    pending: 'text-yellow-400 bg-yellow-900/30',
    failed: 'text-red-400 bg-red-900/30',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">EyeMix admin overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Couples"
          value={loading ? '...' : stats.couples}
          color="primary"
          to="/admin/couples"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Iris Merges"
          value={loading ? '...' : stats.merges}
          color="accent"
          to="/admin/history"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Templates"
          value={loading ? '...' : stats.templates}
          color="primary"
          to="/admin/templates"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/merge/new" className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Merge
          </Link>
          <Link to="/admin/templates" className="btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Manage Templates
          </Link>
          <Link to="/admin/couples" className="btn-secondary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Couple
          </Link>
        </div>
      </div>

      {/* Recent merges */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Recent Merges</h2>
          <Link to="/admin/history" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-surface-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentMerges.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No merges yet. Create your first iris merge!</p>
        ) : (
          <div className="space-y-2">
            {recentMerges.map((merge) => (
              <div key={merge.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-border/50 transition-colors">
                {merge.result_image_url ? (
                  <img src={merge.result_image_url} alt="Result" className="w-10 h-10 rounded-full object-cover border border-surface-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-border flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {merge.couples?.person_a_name} & {merge.couples?.person_b_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {merge.prompt_templates?.name} · {formatDate(merge.created_at)}
                  </p>
                </div>
                <span className={`badge ${statusColors[merge.status] || 'text-slate-400 bg-surface-border'}`}>
                  {merge.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
