import React from 'react';

export default function MockupMagnet({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 130, height: 105 }}>
        {/* Fridge surface suggestion */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(145deg, #e8e8e8, #d0d0d0)',
            boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.6), inset 0 -1px 3px rgba(0,0,0,0.1)',
          }}
        />

        {/* Magnet */}
        <div
          className="absolute"
          style={{
            top: 10, left: 10, right: 10, bottom: 10,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Gradient border */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #9333ea, #0284c7)',
              padding: 2,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 6,
                overflow: 'hidden',
                background: '#0f0f1a',
              }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Magnet" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />
              )}
            </div>
          </div>

          {/* Gloss reflection */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '40%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
              borderRadius: '8px 8px 0 0',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">Fridge Magnet</p>
    </div>
  );
}
