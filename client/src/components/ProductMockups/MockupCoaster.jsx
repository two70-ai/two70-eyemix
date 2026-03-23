import React from 'react';

export default function MockupCoaster({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="coasterSurface" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2a2a40" />
              <stop offset="100%" stopColor="#1a1a2e" />
            </radialGradient>
            <radialGradient id="coasterShine" cx="35%" cy="35%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <clipPath id="coasterClip">
              <circle cx="70" cy="70" r="56" />
            </clipPath>
          </defs>

          {/* Shadow */}
          <ellipse cx="72" cy="128" rx="52" ry="8" fill="rgba(0,0,0,0.35)" />

          {/* Cork base */}
          <circle cx="70" cy="70" r="62" fill="#7c5a2a" />
          <circle cx="70" cy="70" r="60" fill="#9b6f35" />

          {/* Cork texture dots */}
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const r = 50;
            const cx = 70 + Math.cos(angle) * r;
            const cy = 70 + Math.sin(angle) * r;
            return <circle key={i} cx={cx} cy={cy} r={1.5} fill="rgba(0,0,0,0.2)" />;
          })}

          {/* Main surface */}
          <circle cx="70" cy="70" r="56" fill="url(#coasterSurface)" />

          {/* Image */}
          {imageUrl && (
            <image
              href={imageUrl}
              x="14"
              y="14"
              width="112"
              height="112"
              clipPath="url(#coasterClip)"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.9"
            />
          )}

          {/* Rim */}
          <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

          {/* Shine */}
          <circle cx="70" cy="70" r="56" fill="url(#coasterShine)" />

          {/* Gradient edge ring */}
          <circle cx="70" cy="70" r="57" fill="none" stroke="url(#coasterEdge)" strokeWidth="2" opacity="0.5" />
          <defs>
            <linearGradient id="coasterEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p className="text-xs text-slate-400">Cup Coaster</p>
    </div>
  );
}
