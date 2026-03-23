import React from 'react';

export default function MockupCharm({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 100, height: 140 }}>
        <svg width="100" height="140" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="50%" stopColor="#f5d060" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>
            <linearGradient id="charmEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5d060" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#a07830" />
            </linearGradient>
            <clipPath id="charmCircle">
              <circle cx="50" cy="95" r="36" />
            </clipPath>
          </defs>

          {/* Chain bail */}
          <ellipse cx="50" cy="12" rx="8" ry="5" fill="none" stroke="url(#chainGrad)" strokeWidth="3" />
          <line x1="50" y1="17" x2="50" y2="60" stroke="url(#chainGrad)" strokeWidth="2.5" />

          {/* Jump ring */}
          <ellipse cx="50" cy="60" rx="6" ry="4" fill="none" stroke="url(#chainGrad)" strokeWidth="2" />

          {/* Charm outer rim */}
          <circle cx="50" cy="95" r="38" fill="url(#charmEdge)" />
          <circle cx="50" cy="95" r="36" fill="#1a1a1a" />

          {/* Image inside charm */}
          {imageUrl && (
            <image
              href={imageUrl}
              x="14"
              y="59"
              width="72"
              height="72"
              clipPath="url(#charmCircle)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Glass dome reflection */}
          <ellipse cx="38" cy="82" rx="10" ry="7" fill="rgba(255,255,255,0.12)" transform="rotate(-30 38 82)" />

          {/* Rim highlight */}
          <circle cx="50" cy="95" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        </svg>
      </div>
      <p className="text-xs text-slate-400">Charm / Pendant</p>
    </div>
  );
}
