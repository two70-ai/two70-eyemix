import React, { useState } from 'react';
import MockupFrame from './MockupFrame.jsx';
import MockupMug from './MockupMug.jsx';
import MockupHeatMug from './MockupHeatMug.jsx';
import MockupCharm from './MockupCharm.jsx';
import MockupKeychain from './MockupKeychain.jsx';
import MockupMagnet from './MockupMagnet.jsx';
import MockupCoaster from './MockupCoaster.jsx';

const MOCKUP_TABS = [
  { id: 'frame', label: '🖼 Frame', Component: MockupFrame },
  { id: 'mug', label: '☕ Mug', Component: MockupMug },
  { id: 'heat-mug', label: '🔥 Heat Mug', Component: MockupHeatMug },
  { id: 'charm', label: '💎 Charm', Component: MockupCharm },
  { id: 'keychain', label: '🔑 Keychain', Component: MockupKeychain },
  { id: 'magnet', label: '🧲 Magnet', Component: MockupMagnet },
  { id: 'coaster', label: '⚫ Coaster', Component: MockupCoaster },
];

export default function MockupGallery({ imageUrl }) {
  const [activeTab, setActiveTab] = useState('frame');

  if (!imageUrl) {
    return (
      <div className="text-center py-8 text-slate-500">
        No image available for mockups
      </div>
    );
  }

  const activeItem = MOCKUP_TABS.find((t) => t.id === activeTab);
  const ActiveComponent = activeItem?.Component;

  return (
    <div className="space-y-4">
      {/* Tab bar — scrollable on mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {MOCKUP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-700 text-white'
                : 'bg-surface-border/50 text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active mockup display */}
      <div className="flex justify-center py-6 bg-surface-border/20 rounded-xl min-h-[280px] items-center">
        {ActiveComponent && <ActiveComponent imageUrl={imageUrl} />}
      </div>

      {/* All mockups grid (compact overview) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200 transition-colors">
          View all mockups at once ▾
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-surface-border">
          {MOCKUP_TABS.map((tab) => (
            <div key={tab.id} className="flex justify-center">
              <tab.Component imageUrl={imageUrl} />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
