import React, { useState, useEffect } from 'react';

export default function MockupHeatMug({ imageUrl }) {
  const [hot, setHot] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Auto-cycle the heat reveal animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setHot((prev) => !prev);
        setTimeout(() => setAnimating(false), 800);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 160, height: 170 }}>
        <svg width="160" height="170" viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="heatMugBody">
              <path d="M20 20 Q20 10 30 10 H120 Q130 10 130 20 L120 155 Q120 165 110 165 H40 Q30 165 30 155 Z" />
            </clipPath>
          </defs>

          {/* Mug body — black base */}
          <path
            d="M20 20 Q20 10 30 10 H120 Q130 10 130 20 L120 155 Q120 165 110 165 H40 Q30 165 30 155 Z"
            fill="#1a1a1a"
            stroke="#333"
            strokeWidth="1"
          />

          {/* Hidden image (heat-revealed) */}
          {imageUrl && (
            <image
              href={imageUrl}
              x="35"
              y="30"
              width="80"
              height="100"
              clipPath="url(#heatMugBody)"
              preserveAspectRatio="xMidYMid slice"
              style={{
                opacity: hot ? 0.85 : 0,
                transition: 'opacity 0.8s ease',
                filter: animating ? 'blur(2px)' : 'blur(0px)',
              }}
            />
          )}

          {/* Cold state overlay pattern */}
          <g clipPath="url(#heatMugBody)" style={{ opacity: hot ? 0 : 0.6, transition: 'opacity 0.8s ease' }}>
            <rect x="20" y="10" width="110" height="155" fill="#1a1a1a" />
            {/* Subtle pattern */}
            {[...Array(5)].map((_, i) => (
              <circle key={i} cx={45 + i * 18} cy={87} r={12} fill="none" stroke="#2a2a2a" strokeWidth="1" />
            ))}
          </g>

          {/* Steam when hot */}
          {hot && (
            <>
              <path d="M55 8 Q58 1 61 8 Q64 15 67 8" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
              <path d="M70 6 Q73 -1 76 6 Q79 13 82 6" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
              <path d="M85 8 Q88 1 91 8 Q94 15 97 8" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
            </>
          )}

          {/* Rim */}
          <ellipse cx="75" cy="13" rx="50" ry="8" fill="#111" stroke="#333" strokeWidth="1" />

          {/* Handle */}
          <path d="M128 50 Q155 50 155 85 Q155 120 128 120" fill="none" stroke="#222" strokeWidth="14" strokeLinecap="round" />
          <path d="M128 50 Q148 50 148 85 Q148 120 128 120" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round" />

          {/* Shine */}
          <path d="M30 25 L35 150" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />

          {/* Bottom */}
          <ellipse cx="75" cy="160" rx="40" ry="7" fill="#111" stroke="#333" strokeWidth="1" />
        </svg>

        {/* Temperature indicator */}
        <div className={`absolute bottom-12 left-0 right-0 flex justify-center transition-colors duration-500 ${hot ? 'text-orange-400' : 'text-slate-600'}`}>
          <span className="text-xs font-medium">{hot ? '🔥 HOT' : '❄️ COLD'}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">Heat-Reveal Mug</p>
      <p className="text-xs text-slate-600">(Auto-animating preview)</p>
    </div>
  );
}
