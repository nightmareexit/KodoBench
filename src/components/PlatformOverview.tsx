import React, { useState } from 'react';
import { ArrowRight, Code2, Cpu, FileCode2, Layers, TerminalSquare } from 'lucide-react';
import { PROJECT_TEMPLATES } from '../data/templates';
import { PlatformView, ProjectTemplate } from '../types/workspace';

interface PlatformOverviewProps {
  onOpenWorkspace: () => void;
  onLaunchWithPrompt: (prompt: string, targetStack: 'web' | 'luau') => void;
  onLoadTemplate: (template: ProjectTemplate) => void;
  onNavigate: (view: PlatformView) => void;
}

const LANGUAGE_CARDS = [
  {
    name: 'HTML5',
    meta: 'マークアップ · セマンティクス',
    summary: 'ランドマーク構造、アクセシブルなフォーム設計、メタ情報を含めた画面骨格を自動構築します。',
    features: ['ライブ DOM プレビュー同期', 'alt 属性・構造チェック', '単一ファイル/マルチファイル連携'],
    targetStack: 'web' as const,
  },
  {
    name: 'CSS3',
    meta: 'レイアウト · スタイリング',
    summary: 'CSS Grid / Flexbox やカスタムプロパティを用い、崩れにくいレスポンシブUIを生成します。',
    features: ['デスクトップ / モバイル幅切替', '詳細度・波括弧の静的検査', 'コンポーネント単位のスタイル適用'],
    targetStack: 'web' as const,
  },
  {
    name: 'JavaScript',
    meta: 'ES2024 · インタラクション',
    summary: '状態管理、イベント処理、Canvas 描画、非同期通信をバニラJSで安全かつ軽量に実装します。',
    features: ['サンドボックス内リアルタイム実行', 'console.log / エラー即時捕捉', '関数・クラスアウトライン抽出'],
    targetStack: 'web' as const,
  },
  {
    name: 'Luau',
    meta: 'Roblox 型付き Lua · --!strict',
    summary: '厳格な型注釈、Service 取得、DataStore / TweenService / OOP モジュール設計をネイティブに支援します。',
    features: ['--!strict 型構文チェック', '非推奨 wait/spawn 自動検出', 'ブロック対応・接続リーク検査'],
    targetStack: 'luau' as const,
  },
];

const HERO_PREVIEW_SNIPPETS = {
  web: {
    filename: 'app.js',
    caption: 'Web リアルタイム DOM & 状態制御',
    code: `const statusText = document.getElementById('status');
const filterButtons = document.querySelectorAll('[data-filter]');

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.filter ?? 'all';
    statusText.textContent = '表示フィルタ: ' + mode;
    renderBoard(mode);
  });
});`,
  },
  luau: {
    filename: 'CoinService.server.luau',
    caption: 'Roblox Luau --!strict 型付きサーバー処理',
    code: `--!strict
local Players = game:GetService("Players")

export type PlayerWallet = {
	coins: number,
	multiplier: number,
}

local wallets: { [Player]: PlayerWallet } = {}

Players.PlayerAdded:Connect(function(player: Player)
	wallets[player] = { coins = 0, multiplier = 1 }
end)`,
  },
};

export const PlatformOverview: React.FC<PlatformOverviewProps> = ({
  onOpenWorkspace,
  onLaunchWithPrompt,
  onLoadTemplate,
  onNavigate,
}) => {
  const [heroPrompt, setHeroPrompt] = useState('');
  const [heroStack, setHeroStack] = useState<'web' | 'luau'>('web');
  const [previewTab, setPreviewTab] = useState<'web' | 'luau'>('luau');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroPrompt.trim();
    if (!trimmed) {
      onOpenWorkspace();
      return;
    }
    onLaunchWithPrompt(trimmed, heroStack);
  };

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* Hero Split */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-stretch gap-12 px-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <p className="text-xs font-semibold tracking-wide text-blue-700">
                コーディングAIエージェント統合開発プラットフォーム
              </p>
              <h1 className="mt-3 max-w-2xl text-balance font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-[1.15]">
                HTML・CSS・JS・Luau をひとつのワークスペースで実装
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600">
                プロジェクト内の複数ファイルを読み取るコーディングAIエージェントが、新規実装・バグ修正・Luau の厳格型（--!strict）レビューまで一気通貫で支援します。生成コードはその場でプレビューまたは静的解析できます。
              </p>

              {/* Interactive Prompt Launcher */}
              <form
                onSubmit={handleHeroSubmit}
                className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                  <span className="text-xs font-semibold text-slate-700">
                    AIエージェントに開発を指示してワークスペースを開始
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-200/80 p-1" role="group" aria-label="初期プロジェクト種別">
                    <button
                      type="button"
                      onClick={() => setHeroStack('web')}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        heroStack === 'web'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Web (HTML/CSS/JS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroStack('luau')}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        heroStack === 'luau'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Roblox Luau
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={heroPrompt}
                    onChange={(e) => setHeroPrompt(e.target.value)}
                    placeholder={
                      heroStack === 'web'
                        ? '例: 検索機能とダークモード切替つきのスニペット管理UIを作って'
                        : '例: --!strict でプレイヤーのスタミナ回復とスプリント制御モジュールを作って'
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  >
                    <span>エージェントを起動</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 pt-6 border-t border-slate-100 text-sm">
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-blue-600 transition-colors"
              >
                空のワークスペースを開く
              </button>
              <button
                type="button"
                onClick={() => onNavigate('templates')}
                className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                テンプレート一覧を見る
              </button>
              <button
                type="button"
                onClick={() => onNavigate('reference')}
                className="font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Luau / Web リファレンス
              </button>
            </div>
          </div>

          {/* Right Dominant Visual Anchor: Live Interactive Code & Capabilities Frame */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <FileCode2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <span>{HERO_PREVIEW_SNIPPETS[previewTab].filename}</span>
              </div>
              <div className="inline-flex rounded-md bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('luau')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    previewTab === 'luau' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Luau
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('web')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    previewTab === 'web' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Web JS
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto p-5 font-mono text-[13px] leading-6 text-slate-200">
              <pre className="m-0 whitespace-pre">{HERO_PREVIEW_SNIPPETS[previewTab].code}</pre>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
              <span>{HERO_PREVIEW_SNIPPETS[previewTab].caption}</span>
              <button
                type="button"
                onClick={() => {
                  const tmpl =
                    PROJECT_TEMPLATES.find((t) => t.category === previewTab) || PROJECT_TEMPLATES[0];
                  onLoadTemplate(tmpl);
                }}
                className="font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0"
              >
                エディタで編集 →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 01. Supported Languages Matrix */}
      <section className="mx-auto max-w-[1440px] px-6 py-16">
        <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              01. 対応言語と組み込み検証エンジン
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Web フロントエンドの 3 言語と Roblox 向け Luau に最適化されたプロンプト設計、構文ハイライト、および即時検証機能を備えています。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {LANGUAGE_CARDS.map((card) => (
            <article
              key={card.name}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div>
                <div className="text-xs font-medium text-slate-500">{card.meta}</div>
                <h3 className="mt-1.5 font-display text-xl font-bold text-slate-900">{card.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.summary}</p>
                <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-700">
                  {card.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold" aria-hidden="true">·</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  const tmpl =
                    PROJECT_TEMPLATES.find((t) => t.category === card.targetStack) ||
                    PROJECT_TEMPLATES[0];
                  onLoadTemplate(tmpl);
                }}
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                <span>テンプレートで試す</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* 02. Mechanism-to-Outcome Workflow */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-6 py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            02. AIエージェントによる開発ワークフロー
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            コード生成だけで終わらず、マルチファイルへの差分適用からライブ実行・静的型レビューまでひとつの画面で完結します。
          </p>

          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Layers className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>01. プロジェクト文脈を丸ごと把握</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                HTML・CSS・JS や複数の `.luau` モジュール間の依存関係をコンテキストとして共有。既存の変数名や型定義と整合するコードを提案します。
              </p>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Cpu className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>02. 3つの専門エージェントモード</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                「実装・生成」「レビュー・修正」「解説・変換」を切り替え可能。提案されたファイル変更はワンクリックでワークスペースへ反映できます。
              </p>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <TerminalSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>03. ライブプレビューと静的解析</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Web コードはブラウザ内で即座に描画・コンソール監視。Luau は `--!strict` の有無、非推奨 API、ブロック終端漏れをリアルタイム診断します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03. Featured Templates */}
      <section className="mx-auto max-w-[1440px] px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              03. すぐ動かせるスターターテンプレート
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Web アプリから Roblox のサーバー／クライアントスクリプトまで、そのまま拡張できる構成を用意しています。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('templates')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            すべて表示 →
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {PROJECT_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {template.category === 'web' ? 'Web スタック' : 'Roblox Luau'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{template.files.map((f) => f.name).join(' / ')}</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                  {template.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{template.summary}</p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500 tabular-nums">
                  {template.files.length} ファイル収録
                </span>
                <button
                  type="button"
                  onClick={() => onLoadTemplate(template)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
                >
                  <Code2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>ワークスペースで開く</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-6 py-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} KodoBench — HTML · CSS · JavaScript · Luau 開発支援プラットフォーム</span>
          <div className="flex items-center gap-6">
            <button type="button" onClick={onOpenWorkspace} className="hover:text-slate-900">
              ワークスペース
            </button>
            <button type="button" onClick={() => onNavigate('templates')} className="hover:text-slate-900">
              テンプレート
            </button>
            <button type="button" onClick={() => onNavigate('reference')} className="hover:text-slate-900">
              リファレンス
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
