import React from 'react';

export default function MockupMug({ imageUrl }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 160, height: 170 }}>
        <svg width="160" height="170" viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Mug body clip path */}
          <defs>
            <clipPath id="mugBody">
              <path d="M20 20 Q20 10 30 10 H120 Q130 10 130 20 L120 155 Q120 165 110 165 H40 Q30 165 30 155 Z" />
            </clipPath>
            <linearGradient id="mugGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#374151" />
              <stop offset="30%" stopColor="#4b5563" />
              <stop offset="70%" stopColor="#4b5563" />
              <stop offset="100%" stopColor="#374151" />
            </linearGradient>
          </defs>

          {/* Mug body */}
          <path
            d="M20 20 Q20 10 30 10 H120 Q130 10 130 20 L120 155 Q120 165 110 165 H40 Q30 165 30 155 Z"
            fill="url(#mugGrad)"
            stroke="#6b7280"
            strokeWidth="1"
          />

          {/* Image on mug */}
          {imageUrl && (
            <image
              href={imageUrl}
              x="35"
              y="30"
              width="80"
              height="100"
              clipPath="url(#mugBody)"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.85"
            />
          )}

          {/* Mug rim */}
          <ellipse cx="75" cy="13" rx="50" ry="8" fill="#4b5563" stroke="#6b7280" strokeWidth="1" />

          {/* Handle */}
          <path
            d="M128 50 Q155 50 155 85 Q155 120 128 120"
            fill="none"
            stroke="#4b5563"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M128 50 Q148 50 148 85 Q148 120 128 120"
            fill="none"
            stroke="#6b7280"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Shine */}
          <path
            d="M30 25 L35 150"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Bottom ellipse */}
          <ellipse cx="75" cy="160" rx="40" ry="7" fill="#374151" stroke="#6b7280" strokeWidth="1" />
        </svg>
      </div>
      <p className="text-xs text-slate-400">Coffee Mug</p>
    </div>
  );
}
