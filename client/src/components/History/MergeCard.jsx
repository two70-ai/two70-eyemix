import React from 'react';
import { formatDate, downloadImage } from '../../utils/imageUtils.js';

const STATUS_STYLES = {
  completed: 'bg-green-500/10 text-green-400',
  pending: 'bg-amber-500/10 text-amber-400',
  processing: 'bg-blue-500/10 text-blue-400',
  failed: 'bg-red-500/10 text-red-400',
};

export default function MergeCard({ merge, onDelete, showDelete = false }) {
  const coupleName = merge.couples
    ? `${merge.couples.person_a_name} & ${merge.couples.person_b_name}`
    : 'Unknown Couple';
  const templateName = merge.prompt_templates?.name || 'No template';
  const status = merge.status || 'pending';

  return (
    <div className="card overflow-hidden group">
      {/* Thumbnail */}
      <div className="aspect-square bg-surface-border relative overflow-hidden">
        {merge.result_url ? (
          <img
            src={merge.result_url}
            alt={coupleName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600">
            👁️
          </div>
        )}

        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}
        >
          {status}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-slate-100 font-medium text-sm truncate">{coupleName}</p>
        <p className="text-slate-500 text-xs truncate">{templateName}</p>
        <p className="text-slate-600 text-xs">{formatDate(merge.created_at)}</p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {merge.result_url && (
            <button
              onClick={() => downloadImage(merge.result_url, `eyemix-${merge.id}.png`)}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              ⬇ Download
            </button>
          )}
          {showDelete && onDelete && (
            <button
              onClick={() => onDelete(merge.id)}
              className="text-xs text-red-400 hover:text-red-300 ml-auto"
            >
              🗑 Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
