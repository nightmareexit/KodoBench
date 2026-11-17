import React from 'react';
import { PlatformView } from '../types/workspace';

interface TopBarProps {
  activeView: PlatformView;
  onNavigate: (view: PlatformView) => void;
  onNewProject: () => void;
}

const NAV_ITEMS: Array<{ id: PlatformView; label: string }> = [
  { id: 'overview', label: 'プラットフォーム' },
  { id: 'workspace', label: 'ワークスペース' },
  { id: 'templates', label: 'テンプレート' },
  { id: 'reference', label: 'リファレンス' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeView, onNavigate, onNewProject }) => {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-8 px-6">
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm dark:text-slate-100"
        >
          KodoBench
        </button>

        <nav className="hidden md:flex items-center gap-7" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewProject}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            新規プロジェクト
          </button>
        </div>
      </div>

      {/* Compact mobile nav bar */}
      <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`text-xs font-medium whitespace-nowrap shrink-0 px-2 py-1 rounded ${
              activeView === item.id
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
