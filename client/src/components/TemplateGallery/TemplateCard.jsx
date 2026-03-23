import React from 'react';
import { motion } from 'framer-motion';

export default function TemplateCard({ template, selected, onSelect }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(template)}
      className={`card cursor-pointer transition-all duration-200 overflow-hidden group relative ${
        selected
          ? 'border-primary-500 shadow-glow bg-primary-900/20'
          : 'hover:border-primary-700/60'
      }`}
    >
      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center z-10">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Reference image */}
      <div className="w-full h-36 rounded-lg overflow-hidden mb-3 bg-surface-border relative">
        {template.reference_image_url ? (
          <img
            src={template.reference_image_url}
            alt={template.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-600">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-xs">No preview yet</span>
          </div>
        )}

        {/* Category badge */}
        <div className="absolute bottom-2 left-2">
          <span className="badge bg-black/70 text-slate-300 backdrop-blur-sm">{template.category}</span>
        </div>
      </div>

      <h3 className={`font-semibold mb-1 transition-colors ${selected ? 'text-primary-300' : 'text-slate-100'}`}>
        {template.name}
      </h3>
      <p className="text-xs text-slate-400 line-clamp-2">{template.description}</p>
    </motion.div>
  );
}
