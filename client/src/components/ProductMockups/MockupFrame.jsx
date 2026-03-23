import React from 'react';

export default function MockupFrame({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* A4 Photo Frame */}
      <div className="relative" style={{ width: 180, height: 240 }}>
        {/* Outer frame */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            background: 'linear-gradient(145deg, #c8a96e, #a07840, #c8a96e, #8b6420)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.15)',
          }}
        />
        {/* Inner frame recess */}
        <div
          className="absolute"
          style={{
            top: 12, left: 12, right: 12, bottom: 12,
            background: '#6b4a1a',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
          }}
        />
        {/* Mat board */}
        <div
          className="absolute"
          style={{
            top: 18, left: 18, right: 18, bottom: 18,
            background: '#f5f0e8',
          }}
        />
        {/* Image area */}
        <div
          className="absolute overflow-hidden"
          style={{ top: 28, left: 28, right: 28, bottom: 28 }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Frame" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-border" />
          )}
        </div>
        {/* Glass reflection */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 18, left: 18, right: 18, bottom: 18,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }}
        />
      </div>
      <p className="text-xs text-slate-400">A4 Photo Frame</p>
    </div>
  );
}
