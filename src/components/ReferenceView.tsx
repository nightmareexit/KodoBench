import React, { useMemo, useState } from 'react';
import { Check, Copy, Play, Search } from 'lucide-react';
import { LANGUAGE_REFERENCES, ReferenceItem } from '../data/reference';
import { getLanguageLabel } from '../lib/analyzer';
import { SupportedLanguage } from '../types/workspace';

interface ReferenceViewProps {
  onOpenSnippetInWorkspace: (item: ReferenceItem) => void;
}

export const ReferenceView: React.FC<ReferenceViewProps> = ({ onOpenSnippetInWorkspace }) => {
  const [selectedLang, setSelectedLang] = useState<'all' | SupportedLanguage>('all');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGE_REFERENCES.filter((item) => {
      if (selectedLang !== 'all' && item.language !== selectedLang) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    });
  }, [selectedLang, query]);

  const handleCopy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard fallback not critical
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              言語リファレンス & 実装パターン
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              HTML・CSS・JavaScript・Luau の推奨パターンと静的解析のポイントをまとめています。各スニペットはそのままワークスペースで編集・テストできます。
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
                placeholder="キーワード検索..."
                className="w-52 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-800" role="group" aria-label="言語フィルタ">
              {(
                [
                  { id: 'all', label: 'すべて' },
                  { id: 'html', label: 'HTML' },
                  { id: 'css', label: 'CSS' },
                  { id: 'javascript', label: 'JS' },
                  { id: 'luau', label: 'Luau' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedLang(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    selectedLang === tab.id
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

        <div className="mt-8 space-y-6">
          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                該当するリファレンス項目がありません。
              </p>
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  <div className="flex flex-col justify-between p-6 lg:col-span-5">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {getLanguageLabel(item.language)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.filename}</span>
                      </div>
                      <h2 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.summary}
                      </p>
                      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
                        {item.notes.map((note) => (
                          <li key={note} className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold" aria-hidden="true">·</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onOpenSnippetInWorkspace(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>エディタに読み込む</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.code)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            <span>コピー済み</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>コードをコピー</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-950 p-5 font-mono text-[13px] leading-6 text-slate-200 overflow-x-auto lg:col-span-7 lg:border-l lg:border-t-0 dark:border-slate-800">
                    <pre className="m-0 whitespace-pre">{item.code}</pre>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
