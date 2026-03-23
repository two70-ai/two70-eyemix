import React from 'react';

export default function MockupKeychain({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 100, height: 160 }}>
        <svg width="100" height="160" viewBox="0 0 100 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ringMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c0c0c0" />
              <stop offset="50%" stopColor="#e8e8e8" />
              <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
            <linearGradient id="keychainEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <clipPath id="keychainRect">
              <rect x="18" y="65" width="64" height="80" rx="8" />
            </clipPath>
          </defs>

          {/* Key ring */}
          <ellipse cx="50" cy="16" rx="16" ry="12" fill="none" stroke="url(#ringMetal)" strokeWidth="5" />
          <ellipse cx="50" cy="16" rx="16" ry="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

          {/* Chain */}
          <line x1="50" y1="28" x2="50" y2="58" stroke="url(#ringMetal)" strokeWidth="2.5" />

          {/* Acrylic body */}
          <rect x="14" y="58" width="72" height="90" rx="10" fill="#1a1a2e" stroke="url(#keychainEdge)" strokeWidth="2" />
          <rect x="18" y="62" width="64" height="82" rx="8" fill="#0f0f1a" />

          {/* Image */}
          {imageUrl && (
            <image
              href={imageUrl}
              x="18"
              y="62"
              width="64"
              height="82"
              clipPath="url(#keychainRect)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Gloss overlay */}
          <rect x="18" y="62" width="64" height="30" rx="8" fill="rgba(255,255,255,0.05)" />

          {/* Corner badge */}
          <circle cx="75" cy="75" r="8" fill="url(#keychainEdge)" opacity="0.8" />
          <text x="75" y="78.5" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">EM</text>
        </svg>
      </div>
      <p className="text-xs text-slate-400">Keychain</p>
    </div>
  );
}
