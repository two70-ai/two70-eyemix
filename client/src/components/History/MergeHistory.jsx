import React from 'react';
import MergeCard from './MergeCard.jsx';

/**
 * Reusable merge history list component.
 * Displays a grid of MergeCards with optional delete handling.
 *
 * @param {Object[]} merges - Array of merge objects (with couples, prompt_templates relations)
 * @param {boolean} loading - Show skeleton loading state
 * @param {Function} [onDelete] - Optional delete handler (merge id => void)
 * @param {boolean} [showDelete] - Show delete button on cards
 * @param {string} [emptyMessage] - Custom empty state message
 */
export default function MergeHistory({
  merges = [],
  loading = false,
  onDelete,
  showDelete = false,
  emptyMessage = 'No merge history yet.',
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 bg-surface-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (merges.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {merges.map((merge) => (
        <MergeCard
          key={merge.id}
          merge={merge}
          onDelete={onDelete}
          showDelete={showDelete}
        />
      ))}
    </div>
  );
}
