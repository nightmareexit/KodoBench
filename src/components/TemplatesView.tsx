import React, { useMemo, useState } from 'react';
import { Code2, Search } from 'lucide-react';
import { PROJECT_TEMPLATES } from '../data/templates';
import { getLanguageLabel } from '../lib/analyzer';
import { ProjectTemplate } from '../types/workspace';

interface TemplatesViewProps {
  onLoadTemplate: (template: ProjectTemplate) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onLoadTemplate }) => {
  const [category, setCategory] = useState<'all' | 'web' | 'luau'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROJECT_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.files.some((f) => f.name.toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              スターターテンプレート
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Web（HTML・CSS・JS）と Roblox Luau の実践的な構成をそのままワークスペースへ読み込めます。読み込み後は AI エージェントに機能追加を指示できます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="テンプレートを検索..."
                className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-800" role="group" aria-label="テンプレートカテゴリ">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'web', label: 'Web (HTML/CSS/JS)' },
                { id: 'luau', label: 'Roblox Luau' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id as 'all' | 'web' | 'luau')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    category === tab.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-12 rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              条件に一致するテンプレートが見つかりませんでした。
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory('all');
                setQuery('');
              }}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              フィルタをリセット
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filtered.map((template) => (
              <article
                key={template.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      {template.category === 'web' ? 'Web スタック' : 'Roblox Luau'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {template.languages.map((l) => getLanguageLabel(l)).join(' / ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{template.files.length} ファイル</span>
                  </div>

                  <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                    {template.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {template.summary}
                  </p>

                  <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      収録ファイル構成
                    </div>
                    <ul className="mt-2 space-y-1.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {template.files.map((file) => (
                        <li key={file.name} className="flex items-center justify-between">
                          <span>{file.name}</span>
                          <span className="tabular-nums text-slate-400 dark:text-slate-500">
                            {file.content.split('\n').length} 行
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onLoadTemplate(template)}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <Code2 className="h-4 w-4" aria-hidden="true" />
                    <span>ワークスペースに読み込む</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
