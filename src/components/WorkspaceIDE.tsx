import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  Info,
  Laptop,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Square,
  Sun,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  analyzeFile,
  buildPreviewDocument,
  extractOutline,
  getLanguageLabel,
  inferLanguageFromFilename,
} from '../lib/analyzer';
import {
  AgentMessage,
  AgentMode,
  ConsoleLogEntry,
  FilePatch,
  ProjectFile,
  SupportedLanguage,
} from '../types/workspace';
import { CodeEditor } from './CodeEditor';

interface WorkspaceIDEProps {
  projectTitle: string;
  files: ProjectFile[];
  activeFileName: string;
  suggestedPrompts: string[];
  isDark: boolean;
  onToggleDark: () => void;
  onFilesChange: React.Dispatch<React.SetStateAction<ProjectFile[]>>;
  onActiveFileChange: (name: string) => void;
  onOpenTemplateDrawer: () => void;
  pendingAutoPrompt: string | null;
  onConsumePendingPrompt: () => void;
}

type InspectorTab = 'preview' | 'diagnostics' | 'console';
type MobilePane = 'files' | 'editor' | 'preview' | 'agent';
type ProgressStepKey = 'context' | 'thinking' | 'planning' | 'coding' | 'verify' | 'done';

interface AgentProgressState {
  percent: number;
  step: ProgressStepKey;
  label: string;
  detail: string;
}

const PROGRESS_STAGES: Array<{ id: ProgressStepKey; label: string }> = [
  { id: 'context', label: '1. 文脈読込' },
  { id: 'thinking', label: '2. 設計推論' },
  { id: 'coding', label: '3. コード生成' },
  { id: 'verify', label: '4. 検証完了' },
];

function getStageStatus(
  stageId: ProgressStepKey,
  currentStep: ProgressStepKey
): 'done' | 'active' | 'pending' {
  const order: Record<ProgressStepKey, number> = {
    context: 0,
    thinking: 1,
    planning: 1,
    coding: 2,
    verify: 3,
    done: 4,
  };
  const stageIdx = order[stageId];
  const currentIdx = order[currentStep];
  if (currentIdx > stageIdx) return 'done';
  if (currentIdx === stageIdx) return 'active';
  return 'pending';
}

const DEFAULT_SNIPPETS: Record<SupportedLanguage, string> = {
  html: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Page</title>
</head>
<body>
  <main>
    <h1>新規ページ</h1>
  </main>
</body>
</html>`,
  css: `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}`,
  javascript: `console.log('Script initialized');`,
  luau: `--!strict
local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	print("Joined:", player.Name)
end

Players.PlayerAdded:Connect(onPlayerAdded)`,
};

export const WorkspaceIDE: React.FC<WorkspaceIDEProps> = ({
  projectTitle,
  files,
  activeFileName,
  suggestedPrompts,
  isDark,
  onToggleDark,
  onFilesChange,
  onActiveFileChange,
  onOpenTemplateDrawer,
  pendingAutoPrompt,
  onConsumePendingPrompt,
}) => {
  const activeFile = useMemo(
    () => files.find((f) => f.name === activeFileName) || files[0],
    [files, activeFileName]
  );

  const hasHtml = useMemo(() => files.some((f) => f.language === 'html'), [files]);

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(() =>
    activeFile?.language === 'luau' || !hasHtml ? 'diagnostics' : 'preview'
  );
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewNonce, setPreviewNonce] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [copiedCode, setCopiedCode] = useState(false);

  // Mobile responsive pane tab
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');

  // New file inline creator
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState<SupportedLanguage>('luau');
  const [fileError, setFileError] = useState<string | null>(null);

  // AI Agent state + real-time SSE progress
  const [agentMode, setAgentMode] = useState<AgentMode>('build');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgressState>({
    percent: 0,
    step: 'context',
    label: '準備中...',
    detail: '',
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [expandedPatches, setExpandedPatches] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Switch inspector sensibly when switching templates/projects
  useEffect(() => {
    if (activeFile?.language === 'luau' && !hasHtml) {
      setInspectorTab('diagnostics');
    } else if (hasHtml && activeFile?.language !== 'luau') {
      setInspectorTab('preview');
    }
  }, [projectTitle, hasHtml]);

  // Live elapsed timer while AI is working
  useEffect(() => {
    if (!isGenerating) {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  // Abort ongoing request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Listen to preview iframe console bridge
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; level?: ConsoleLogEntry['level']; text?: string };
      if (!data || data.source !== 'kodobench-preview') return;
      const now = new Date();
      const timestamp = now.toLocaleTimeString('ja-JP', { hour12: false });
      setConsoleLogs((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          level: data.level || 'log',
          text: data.text || '',
          timestamp,
        },
      ]);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const outline = useMemo(() => (activeFile ? extractOutline(activeFile) : []), [activeFile]);
  const diagnostics = useMemo(() => (activeFile ? analyzeFile(activeFile) : []), [activeFile]);

  const luauMeta = useMemo(() => {
    if (!activeFile || activeFile.language !== 'luau') return null;
    const isStrict = activeFile.content.trimStart().startsWith('--!strict');
    const services = Array.from(
      new Set(
        Array.from(activeFile.content.matchAll(/game:GetService\(\s*["']([A-Za-z0-9_]+)["']\s*\)/g)).map(
          (m) => m[1]
        )
      )
    );
    return { isStrict, services };
  }, [activeFile]);

  const previewDoc = useMemo(() => buildPreviewDocument(files), [files, previewNonce]);

  const updateActiveFileContent = (nextContent: string) => {
    if (!activeFile) return;
    onFilesChange((prev) =>
      prev.map((f) => (f.name === activeFile.name ? { ...f, content: nextContent } : f))
    );
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmed = newFileName.trim();
    if (!trimmed) {
      setFileError('ファイル名を入力してください。');
      return;
    }
    if (!trimmed.includes('.')) {
      const ext =
        newFileLang === 'html'
          ? '.html'
          : newFileLang === 'css'
          ? '.css'
          : newFileLang === 'luau'
          ? '.luau'
          : '.js';
      trimmed += ext;
    }
    if (files.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setFileError('同名のファイルが既に存在します。');
      return;
    }
    const lang = inferLanguageFromFilename(trimmed);
    const created: ProjectFile = {
      name: trimmed,
      language: lang,
      content: DEFAULT_SNIPPETS[lang],
    };
    onFilesChange((prev) => [...prev, created]);
    onActiveFileChange(trimmed);
    setNewFileName('');
    setFileError(null);
    setCreatingFile(false);
    setMobilePane('editor');
  };

  const handleDeleteFile = (name: string) => {
    if (files.length <= 1) return;
    const remaining = files.filter((f) => f.name !== name);
    onFilesChange(remaining);
    if (activeFileName === name && remaining[0]) {
      onActiveFileChange(remaining[0].name);
    }
  };

  const handleCopyCode = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleDownloadActiveFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyPatchToWorkspace = (messageId: string, patchIndex: number, patch: FilePatch) => {
    onFilesChange((prev) => {
      const exists = prev.some((f) => f.name === patch.path);
      if (exists) {
        return prev.map((f) =>
          f.name === patch.path ? { ...f, language: patch.language, content: patch.content } : f
        );
      }
      return [...prev, { name: patch.path, language: patch.language, content: patch.content }];
    });
    onActiveFileChange(patch.path);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.fileChanges) return m;
        const nextChanges = m.fileChanges.map((c, idx) =>
          idx === patchIndex ? { ...c, applied: true } : c
        );
        return { ...m, fileChanges: nextChanges };
      })
    );
    setPreviewNonce((n) => n + 1);
  };

  const applyAllPatches = (messageId: string, patches: FilePatch[]) => {
    onFilesChange((prev) => {
      const next = [...prev];
      patches.forEach((patch) => {
        const idx = next.findIndex((f) => f.name === patch.path);
        if (idx >= 0) {
          next[idx] = { ...next[idx], language: patch.language, content: patch.content };
        } else {
          next.push({ name: patch.path, language: patch.language, content: patch.content });
        }
      });
      return next;
    });
    if (patches[0]) {
      onActiveFileChange(patches[0].path);
    }
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.fileChanges) return m;
        return { ...m, fileChanges: m.fileChanges.map((c) => ({ ...c, applied: true })) };
      })
    );
    setPreviewNonce((n) => n + 1);
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const sendAgentRequest = useCallback(
    async (rawInput: string, overrideMode?: AgentMode) => {
      if (isGenerating) return;
      const effectiveMode = overrideMode || agentMode;

      let text = rawInput.trim();
      if (!text) {
        if (effectiveMode === 'review') {
          text = `${activeFile?.name || '現在のコード'} のバグ・型安全性・改善点をレビューして修正案を提案してください。`;
        } else if (effectiveMode === 'explain') {
          text = `${activeFile?.name || '現在のコード'} の処理内容と設計のポイントを分かりやすく解説してください。`;
        } else {
          return;
        }
      }

      const nowLabel = new Date().toLocaleTimeString('ja-JP', { hour12: false });
      const userMsg: AgentMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        mode: effectiveMode,
        timestamp: nowLabel,
      };

      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setPromptInput('');
      setIsGenerating(true);
      setAgentProgress({
        percent: 6,
        step: 'context',
        label: 'リクエストを初期化中...',
        detail: `${files.length} ファイルのコンテキストを送信しています`,
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch('/api/agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            mode: effectiveMode,
            activeFileName: activeFile?.name || '',
            files: files.map((f) => ({
              name: f.name,
              language: f.language,
              content: f.content,
            })),
            messages: nextHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const errJson = (await res.json()) as { error?: string };
            if (errJson?.error) errMsg = errJson.error;
          } catch {
            // fallback
          }
          throw new Error(errMsg);
        }

        if (!contentType.includes('text/event-stream') || !res.body) {
          const fallbackJson = (await res.json()) as {
            summary?: string;
            plan?: string[];
            fileChanges?: FilePatch[];
            diagnostics?: AgentMessage['diagnostics'];
          };
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: fallbackJson.summary || '応答を受信しました。',
              mode: effectiveMode,
              plan: Array.isArray(fallbackJson.plan) ? fallbackJson.plan : [],
              fileChanges: Array.isArray(fallbackJson.fileChanges) ? fallbackJson.fileChanges : [],
              diagnostics: Array.isArray(fallbackJson.diagnostics) ? fallbackJson.diagnostics : [],
              timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
            },
          ]);
          return;
        }

        type AgentStreamResult = {
          summary?: string;
          plan?: string[];
          fileChanges?: FilePatch[];
          diagnostics?: AgentMessage['diagnostics'];
        };

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let finalResult: AgentStreamResult | null = null;
        let streamError: string | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';

          for (const block of events) {
            const dataLines = block
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());
            if (dataLines.length === 0) continue;

            try {
              const payload = JSON.parse(dataLines.join('\n')) as {
                type: 'progress' | 'result' | 'error';
                percent?: number;
                step?: ProgressStepKey;
                label?: string;
                detail?: string;
                data?: AgentStreamResult;
                error?: string;
              };

              if (payload.type === 'progress') {
                setAgentProgress({
                  percent: typeof payload.percent === 'number' ? payload.percent : 40,
                  step: payload.step || 'thinking',
                  label: payload.label || '処理中...',
                  detail: payload.detail || '',
                });
              } else if (payload.type === 'result' && payload.data) {
                finalResult = payload.data;
              } else if (payload.type === 'error') {
                streamError = payload.error || 'エージェント処理でエラーが発生しました。';
              }
            } catch {
              // ignore malformed chunk line
            }
          }
        }

        if (streamError) {
          throw new Error(streamError);
        }

        if (!finalResult) {
          throw new Error('AIエージェントからの応答が途中で終了しました。もう一度お試しください。');
        }

        const assistantMsg: AgentMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: finalResult.summary || '処理が完了しました。',
          mode: effectiveMode,
          plan: Array.isArray(finalResult.plan) ? finalResult.plan : [],
          fileChanges: Array.isArray(finalResult.fileChanges) ? finalResult.fileChanges : [],
          diagnostics: Array.isArray(finalResult.diagnostics) ? finalResult.diagnostics : [],
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              id: `c-${Date.now()}`,
              role: 'assistant',
              content: '生成を中断しました。',
              timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
            },
          ]);
        } else {
          const errMessage =
            err instanceof Error ? err.message : '通信エラーが発生しました。';
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: 'assistant',
              content: errMessage,
              error: true,
              timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
            },
          ]);
        }
      } finally {
        abortControllerRef.current = null;
        setIsGenerating(false);
      }
    },
    [isGenerating, agentMode, messages, activeFile, files]
  );

  // Trigger auto-prompt if launched from PlatformOverview
  useEffect(() => {
    if (pendingAutoPrompt && !isGenerating) {
      const promptToRun = pendingAutoPrompt;
      onConsumePendingPrompt();
      setMobilePane('agent');
      void sendAgentRequest(promptToRun, 'build');
    }
  }, [pendingAutoPrompt, isGenerating, onConsumePendingPrompt, sendAgentRequest]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, agentProgress.label]);

  const handleJumpToLine = (line: number, fileName?: string) => {
    if (fileName && files.some((f) => f.name === fileName)) {
      onActiveFileChange(fileName);
    }
    setFocusLine(null);
    requestAnimationFrame(() => setFocusLine(line));
    setMobilePane('editor');
  };

  const handleRequestAiFixDiagnostics = () => {
    if (!activeFile) return;
    setAgentMode('review');
    setMobilePane('agent');
    const summaryList =
      diagnostics.length > 0
        ? diagnostics.map((d) => `- 行 ${d.line} [${d.severity}]: ${d.message}`).join('\n')
        : 'コード全体の型安全性・バグ・パフォーマンス改善点を確認してください。';
    void sendAgentRequest(
      `${activeFile.name} の静的解析結果を確認し、問題点を修正したコードを提案してください。\n${summaryList}`,
      'review'
    );
  };

  const canSubmitPrompt =
    !isGenerating && (promptInput.trim().length > 0 || agentMode === 'review' || agentMode === 'explain');

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Workspace Context Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {projectTitle}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
          <span className="truncate font-mono text-xs text-slate-600 dark:text-slate-300">
            {activeFile?.name}
          </span>
          {activeFile && (
            <>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-xs font-medium text-blue-700 dark:text-blue-400">
                {getLanguageLabel(activeFile.language)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenTemplateDrawer}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            テンプレート切替
          </button>

          <button
            type="button"
            onClick={handleDownloadActiveFile}
            title="現在のファイルをダウンロード"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">保存</span>
          </button>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">ライト</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">ダーク</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Pane Switcher */}
      <div className="flex lg:hidden border-b border-slate-200 bg-slate-100 px-2 py-1.5 gap-1 dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            { id: 'files', label: 'ファイル' },
            { id: 'editor', label: 'エディタ' },
            { id: 'preview', label: hasHtml ? 'プレビュー' : '静的解析' },
            {
              id: 'agent',
              label: isGenerating ? `AI (${agentProgress.percent}%)` : 'AIエージェント',
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
              mobilePane === tab.id
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main 3-Pane IDE Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: File Explorer + Symbol Outline */}
        <aside
          className={`${
            mobilePane === 'files' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              プロジェクトファイル
            </span>
            <button
              type="button"
              onClick={() => {
                setCreatingFile((v) => !v);
                setFileError(null);
              }}
              aria-label="新規ファイルを追加"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>追加</span>
            </button>
          </div>

          {creatingFile && (
            <form
              onSubmit={handleCreateFile}
              className="border-b border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900"
            >
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="例: EnemyAI.server.luau"
                autoFocus
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm md:text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newFileLang}
                  onChange={(e) => setNewFileLang(e.target.value as SupportedLanguage)}
                  aria-label="ファイルの言語"
                  className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="luau">Luau (.luau)</option>
                  <option value="html">HTML (.html)</option>
                  <option value="css">CSS (.css)</option>
                  <option value="javascript">JS (.js)</option>
                </select>
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  作成
                </button>
              </div>
              {fileError && <p className="text-[11px] text-red-600 dark:text-red-400">{fileError}</p>}
            </form>
          )}

          <ul className="ide-scroll flex-1 overflow-y-auto py-1.5">
            {files.map((file) => {
              const isSelected = file.name === activeFile?.name;
              return (
                <li key={file.name} className="group px-2">
                  <div
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-white font-semibold text-slate-900 shadow-xs ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
                        : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onActiveFileChange(file.name);
                        setMobilePane('editor');
                      }}
                      className="flex flex-1 items-center gap-2 truncate text-left"
                    >
                      <FileCode2
                        className={`h-3.5 w-3.5 shrink-0 ${
                          file.language === 'luau'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate font-mono">{file.name}</span>
                    </button>
                    {files.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.name)}
                        aria-label={`${file.name} を削除`}
                        className="ml-1 rounded p-0.5 text-slate-400 hover:text-red-600 lg:hidden lg:group-hover:inline-flex"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Symbol Outline */}
          <div className="border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>アウトライン</span>
              <span className="tabular-nums text-[11px] font-normal text-slate-400">
                {outline.length}
              </span>
            </div>
            <div className="ide-scroll max-h-44 overflow-y-auto px-2 pb-3">
              {outline.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-slate-400">
                  シンボルは検出されませんでした
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {outline.map((sym, idx) => (
                    <li key={`${sym.name}-${sym.line}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleJumpToLine(sym.line)}
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-left font-mono text-[11px] text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        <span className="truncate">{sym.name}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-slate-400">
                          L{sym.line}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Center: Editor + Live Preview / Luau Diagnostics */}
        <section
          className={`${
            mobilePane === 'editor' || mobilePane === 'preview' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden`}
        >
          <div className="flex flex-1 min-h-0 flex-col xl:flex-row">
            {/* Code Editor Pane */}
            <div
              className={`${
                mobilePane === 'editor' ? 'flex' : 'hidden'
              } lg:flex flex-1 min-w-0 min-h-0 flex-col border-b border-slate-200 xl:border-b-0 xl:border-r dark:border-slate-800`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 tabular-nums min-w-0">
                  <span className="truncate font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {activeFile?.name}
                  </span>
                  <span className="shrink-0">
                    行 {cursorPos.line}, 列 {cursorPos.col}
                  </span>
                  <span className="hidden sm:inline shrink-0">
                    {activeFile ? activeFile.content.split('\n').length : 0} 行
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 shrink-0 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>コピー済み</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 min-h-0">
                {activeFile && (
                  <CodeEditor
                    value={activeFile.content}
                    language={activeFile.language}
                    onChange={updateActiveFileContent}
                    isDark={isDark}
                    focusLine={focusLine}
                    onCursorChange={(line, col) => setCursorPos({ line, col })}
                  />
                )}
              </div>
            </div>

            {/* Runtime Preview / Luau Static Analysis / Console Pane */}
            <div
              className={`${
                mobilePane === 'preview' ? 'flex' : 'hidden'
              } lg:flex w-full flex-1 lg:flex-none xl:w-[44%] min-h-0 shrink-0 flex-col bg-white dark:bg-slate-950`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="出力ビュー切替">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === 'preview'}
                    onClick={() => setInspectorTab('preview')}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      inspectorTab === 'preview'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    ライブプレビュー
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === 'diagnostics'}
                    onClick={() => setInspectorTab('diagnostics')}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                      inspectorTab === 'diagnostics'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    静的解析 ({diagnostics.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === 'console'}
                    onClick={() => setInspectorTab('console')}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                      inspectorTab === 'console'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    コンソール ({consoleLogs.length})
                  </button>
                </div>

                {inspectorTab === 'preview' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('desktop')}
                      aria-label="デスクトップ幅"
                      className={`hidden sm:inline-flex rounded p-1 ${
                        previewViewport === 'desktop'
                          ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('mobile')}
                      aria-label="モバイル幅"
                      className={`hidden sm:inline-flex rounded p-1 ${
                        previewViewport === 'mobile'
                          ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConsoleLogs([]);
                        setPreviewNonce((n) => n + 1);
                      }}
                      aria-label="プレビューを再実行"
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {inspectorTab === 'preview' && (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 p-2 dark:bg-slate-900">
                    <iframe
                      key={previewNonce}
                      title="Web ライブプレビュー"
                      srcDoc={previewDoc}
                      sandbox="allow-scripts allow-modals"
                      className={`h-full rounded border border-slate-200 bg-white transition-all dark:border-slate-800 ${
                        previewViewport === 'mobile' ? 'w-[375px] max-w-full' : 'w-full'
                      }`}
                    />
                  </div>
                )}

                {inspectorTab === 'diagnostics' && (
                  <div className="ide-scroll flex h-full flex-col overflow-y-auto p-4 space-y-4">
                    {luauMeta && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Luau ランタイム構成情報
                          </span>
                          <span
                            className={`font-mono font-semibold ${
                              luauMeta.isStrict
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {luauMeta.isStrict ? '--!strict 有効' : '--!strict 未指定'}
                          </span>
                        </div>
                        <div className="mt-2 text-slate-600 dark:text-slate-400">
                          <span>参照サービス: </span>
                          <span className="font-mono">
                            {luauMeta.services.length > 0 ? luauMeta.services.join(', ') : 'なし'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        検出された診断メッセージ ({diagnostics.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleRequestAiFixDiagnostics}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>AIにレビュー・修正を依頼</span>
                      </button>
                    </div>

                    {diagnostics.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900">
                        <CheckCheck className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                          静的解析上のエラーや警告はありません。
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {diagnostics.map((d, idx) => (
                          <li key={`${d.line}-${idx}`}>
                            <button
                              type="button"
                              onClick={() => handleJumpToLine(d.line, d.file)}
                              className="flex w-full items-start gap-3 p-3 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                              {d.severity === 'error' ? (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                              ) : d.severity === 'warning' ? (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                              ) : (
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>行 {d.line}</span>
                                  <span>·</span>
                                  <span>
                                    {d.severity === 'error'
                                      ? 'エラー'
                                      : d.severity === 'warning'
                                      ? '警告'
                                      : 'ヒント'}
                                  </span>
                                </div>
                                <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
                                  {d.message}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {inspectorTab === 'console' && (
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        プレビュー実行コンソール出力
                      </span>
                      <button
                        type="button"
                        onClick={() => setConsoleLogs([])}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        クリア
                      </button>
                    </div>
                    <div className="ide-scroll flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5">
                      {consoleLogs.length === 0 ? (
                        <p className="text-slate-400">コンソール出力はまだありません。</p>
                      ) : (
                        consoleLogs.map((entry) => (
                          <div
                            key={entry.id}
                            className={`flex items-start gap-2 border-b border-slate-100 pb-1.5 dark:border-slate-900 ${
                              entry.level === 'error'
                                ? 'text-red-600 dark:text-red-400'
                                : entry.level === 'warn'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="shrink-0 tabular-nums text-slate-400">
                              [{entry.timestamp}]
                            </span>
                            <span className="break-all whitespace-pre-wrap">{entry.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Coding AI Agent Panel */}
        <aside
          className={`${
            mobilePane === 'agent' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-[400px] xl:w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}
        >
          {/* Agent Header & Mode Switcher */}
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                コーディングAIエージェント
              </span>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  disabled={isGenerating}
                  className="text-xs text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  履歴をクリア
                </button>
              )}
            </div>

            <div
              className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
              role="group"
              aria-label="エージェント動作モード"
            >
              {(
                [
                  { id: 'build', label: '実装・生成' },
                  { id: 'review', label: 'レビュー・修正' },
                  { id: 'explain', label: '解説・変換' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAgentMode(m.id)}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    agentMode === m.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="ide-scroll flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isGenerating && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    現在の参照コンテキスト: {files.length} ファイル（HTML / CSS / JS / Luau）
                  </p>
                  <p className="mt-1.5">
                    機能追加、バグ修正、Luau の `--!strict` 型設計、または JS と Luau 間のロジック変換を指示してください。処理中は進行状況バーに AI の作業内容がリアルタイム表示されます。
                  </p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    クイック指示候補
                  </div>
                  <div className="mt-2 space-y-2">
                    {suggestedPrompts.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => void sendAgentRequest(sp)}
                        className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-600"
                      >
                        <Play className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span>{sp}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg border p-3.5 text-xs ${
                  msg.role === 'user'
                    ? 'border-blue-200 bg-blue-50/60 text-slate-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-100'
                    : msg.error
                    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                    : 'border-slate-200 bg-slate-50/70 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">
                    {msg.role === 'user' ? 'あなた' : 'KodoBench エージェント'}
                  </span>
                  <span className="tabular-nums">{msg.timestamp}</span>
                </div>

                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Agent execution plan */}
                {msg.plan && msg.plan.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      実行ステップ
                    </div>
                    <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {msg.plan.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* AI Diagnostics */}
                {msg.diagnostics && msg.diagnostics.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2.5 space-y-1.5 dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      指摘事項
                    </div>
                    {msg.diagnostics.map((d, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleJumpToLine(d.line, d.file)}
                        className="flex w-full items-start gap-2 rounded bg-white p-2 text-left text-[11px] border border-slate-200 hover:border-blue-400 dark:bg-slate-900 dark:border-slate-800"
                      >
                        <span className="font-mono text-blue-600 shrink-0 dark:text-blue-400">
                          {d.file}:{d.line}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">{d.message}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Proposed File Changes */}
                {msg.fileChanges && msg.fileChanges.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-3 space-y-2.5 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        提案された変更 ({msg.fileChanges.length} ファイル)
                      </span>
                      {msg.fileChanges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => applyAllPatches(msg.id, msg.fileChanges!)}
                          className="text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                        >
                          すべて適用
                        </button>
                      )}
                    </div>

                    {msg.fileChanges.map((patch, idx) => {
                      const patchKey = `${msg.id}-${idx}`;
                      const isExpanded = Boolean(expandedPatches[patchKey]);
                      return (
                        <div
                          key={patchKey}
                          className="rounded-md border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPatches((prev) => ({
                                  ...prev,
                                  [patchKey]: !prev[patchKey],
                                }))
                              }
                              className="flex items-center gap-1.5 min-w-0 text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                              )}
                              <span className="truncate font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                                {patch.path}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-500">
                                {patch.action === 'create' ? '新規' : '更新'}
                              </span>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {patch.applied && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onActiveFileChange(patch.path);
                                    setMobilePane(hasHtml ? 'preview' : 'editor');
                                  }}
                                  className="lg:hidden text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                                >
                                  確認
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => applyPatchToWorkspace(msg.id, idx, patch)}
                                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                  patch.applied
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500'
                                }`}
                              >
                                {patch.applied ? '適用済み' : '適用する'}
                              </button>
                            </div>
                          </div>

                          {patch.rationale && (
                            <div className="border-t border-slate-100 px-2.5 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                              {patch.rationale}
                            </div>
                          )}

                          {isExpanded && (
                            <pre className="ide-scroll max-h-56 overflow-auto border-t border-slate-200 bg-slate-950 p-2.5 font-mono text-[11px] leading-5 text-slate-200 dark:border-slate-800">
                              {patch.content}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Real-time AI Progress Bar & Activity Tracker */}
            {isGenerating && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-blue-200 bg-white p-4 shadow-xs dark:border-blue-900/60 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {agentProgress.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{(elapsedMs / 1000).toFixed(1)}s</span>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      {agentProgress.percent}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div
                  className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuenow={agentProgress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-200 ease-out dark:bg-blue-500"
                    style={{ width: `${Math.max(5, Math.min(100, agentProgress.percent))}%` }}
                  />
                </div>

                {agentProgress.detail && (
                  <p className="mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {agentProgress.detail}
                  </p>
                )}

                {/* 4-Stage Pipeline Indicator */}
                <div className="mt-3 grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  {PROGRESS_STAGES.map((st) => {
                    const status = getStageStatus(st.id, agentProgress.step);
                    return (
                      <div
                        key={st.id}
                        className={`text-center text-[10px] font-medium py-1 rounded ${
                          status === 'done'
                            ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40'
                            : status === 'active'
                            ? 'text-blue-700 bg-blue-50 font-semibold dark:text-blue-300 dark:bg-blue-950/50'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {st.label}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCancelGeneration}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Square className="h-3 w-3" aria-hidden="true" />
                    <span>中断</span>
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Prompt Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendAgentRequest(promptInput);
            }}
            className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 truncate">
              対象: <span className="font-mono">{activeFile?.name}</span> 他 {Math.max(0, files.length - 1)} ファイル
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (canSubmitPrompt) void sendAgentRequest(promptInput);
                  }
                }}
                placeholder={
                  agentMode === 'build'
                    ? '実装・修正したい内容を指示（例: Luauでデイリー報酬システムを追加して）'
                    : agentMode === 'review'
                    ? '重点チェック項目を入力（空欄のまま「実行する」で全体を自動診断）'
                    : '解説や言語変換の指示を入力（空欄のまま「実行する」で全体を解説）'
                }
                className="w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-base md:text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">Ctrl / Cmd + Enter で送信</span>
                <button
                  type="submit"
                  disabled={!canSubmitPrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isGenerating ? '実行中...' : '実行する'}</span>
                </button>
              </div>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};
