import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SupportedLanguage = 'html' | 'css' | 'javascript' | 'luau';
type AgentMode = 'build' | 'review' | 'explain';

interface IncomingFile {
  name: string;
  language: SupportedLanguage;
  content: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentRequestBody {
  mode?: AgentMode;
  activeFileName?: string;
  files?: IncomingFile[];
  messages?: IncomingMessage[];
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(mode: AgentMode, activeFileName: string): string {
  const modeDirective =
    mode === 'build'
      ? 'あなたは実装・生成モードです。ユーザーの要求に基づき、変更が必要なファイルのみを `fileChanges` に出力してください（変更不要なファイルは含めないでください）。省略記号（...）は使わず完全なコードを書いてください。'
      : mode === 'review'
      ? 'あなたはレビュー・修正モードです。バグ、アクセシビリティ問題、JSエラー、あるいは Luau の `--!strict` 型不整合、非推奨API（wait/spawn/delay）、メモリリーク（未切断のRBXScriptConnection）を `diagnostics` に列挙し、修正済みコードを `fileChanges` に提案してください。'
      : 'あなたは解説・変換モードです。コードの構造と動作を日本語で簡潔に解説してください。別言語への変換依頼でない限り `fileChanges` は空配列 `[]` にしてください。';

  return [
    'あなたは KodoBench のコーディングAIエージェントです。対応言語は HTML、CSS、JavaScript、Roblox Luau です。',
    '要件:',
    '- 回答は簡潔かつ正確に日本語で記述する。',
    '- HTML/CSS/JS: モダンで安全なコード（XSS対策、自己完結型）。',
    '- Luau: 先頭に `--!strict`、明示的な型注釈、`game:GetService(...)`、`task.wait/spawn/delay` を使用し、旧グローバルは使わない。',
    `現在のアクティブファイル: ${activeFileName || 'なし'}`,
    modeDirective,
  ].join('\n');
}

const agentResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'ユーザーへの日本語の回答・要約。',
    },
    plan: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '実行・分析した簡潔なステップ（2〜4項目）。',
    },
    fileChanges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: '対象ファイル名',
          },
          language: {
            type: Type.STRING,
            description: 'html, css, javascript, luau のいずれか',
          },
          action: {
            type: Type.STRING,
            description: 'create または update',
          },
          content: {
            type: Type.STRING,
            description: '変更対象ファイルの完全なソースコード',
          },
          rationale: {
            type: Type.STRING,
            description: '変更理由（1行）',
          },
        },
        required: ['path', 'language', 'action', 'content', 'rationale'],
      },
      description: '作成・更新するファイルの配列。不要時は空配列。',
    },
    diagnostics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          file: { type: Type.STRING },
          line: { type: Type.INTEGER },
          severity: {
            type: Type.STRING,
            description: 'error, warning, info のいずれか',
          },
          message: { type: Type.STRING },
        },
        required: ['file', 'line', 'severity', 'message'],
      },
      description: '指摘事項の配列。',
    },
  },
  required: ['summary', 'plan', 'fileChanges', 'diagnostics'],
};

function sanitizeLanguage(lang: string, filePath: string): SupportedLanguage {
  const lower = (lang || '').toLowerCase();
  if (lower === 'html' || filePath.endsWith('.html')) return 'html';
  if (lower === 'css' || filePath.endsWith('.css')) return 'css';
  if (lower === 'luau' || lower === 'lua' || filePath.endsWith('.luau') || filePath.endsWith('.lua')) {
    return 'luau';
  }
  return 'javascript';
}

function buildPromptPayload(files: IncomingFile[], activeFileName: string, messages: IncomingMessage[]): string {
  const filesSnapshot = files
    .map((f) => {
      const cap = f.name === activeFileName ? 16000 : 6000;
      const safeContent = (f.content || '').slice(0, cap);
      return `### ${f.name} (${f.language})\n\`\`\`${f.language}\n${safeContent}\n\`\`\``;
    })
    .join('\n\n');

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`)
    .join('\n\n');

  return [
    '## ワークスペースファイル',
    filesSnapshot || '(ファイルなし)',
    '',
    '## 依頼内容',
    conversationText,
  ].join('\n');
}

function parseAndNormalizeAgentJson(rawText: string, activeFileName: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned) as {
    summary?: string;
    plan?: string[];
    fileChanges?: Array<{
      path?: string;
      language?: string;
      action?: string;
      content?: string;
      rationale?: string;
    }>;
    diagnostics?: Array<{
      file?: string;
      line?: number;
      severity?: string;
      message?: string;
    }>;
  };

  const normalizedChanges = Array.isArray(parsed.fileChanges)
    ? parsed.fileChanges
        .filter((c) => typeof c.path === 'string' && typeof c.content === 'string')
        .map((c) => {
          const p = (c.path || '').trim().replace(/^\/+/, '');
          return {
            path: p,
            language: sanitizeLanguage(c.language || '', p),
            action: c.action === 'create' ? 'create' : 'update',
            content: c.content || '',
            rationale: c.rationale || '',
          };
        })
    : [];

  const normalizedDiagnostics = Array.isArray(parsed.diagnostics)
    ? parsed.diagnostics.map((d) => ({
        file: d.file || activeFileName || 'workspace',
        line: typeof d.line === 'number' && d.line > 0 ? d.line : 1,
        severity: d.severity === 'error' || d.severity === 'warning' ? d.severity : 'info',
        message: d.message || '',
      }))
    : [];

  return {
    summary: parsed.summary || '処理が完了しました。',
    plan: Array.isArray(parsed.plan) ? parsed.plan : [],
    fileChanges: normalizedChanges,
    diagnostics: normalizedDiagnostics,
  };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; message?: string };
  const status = typeof errorObj?.status === 'number' ? errorObj.status : 500;
  const msg = errorObj?.message || 'AIエージェントの呼び出し中にエラーが発生しました。';

  if (status === 400 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return {
      status,
      message: 'APIキーが無効か権限がありません。Settings > Secrets パネルで GEMINI_API_KEY を確認してください。',
    };
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'リクエスト上限に達しました。数秒待ってから再試行してください。',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: `エージェント処理エラー: ${msg}`,
  };
}

function inspectStreamingProgress(rawText: string, mode: AgentMode) {
  const len = rawText.length;
  const pathMatches = Array.from(rawText.matchAll(/"path"\s*:\s*"([^"]+)"/g));
  const lastFile = pathMatches.length > 0 ? pathMatches[pathMatches.length - 1][1] : null;

  if (rawText.includes('"diagnostics"')) {
    return {
      percent: 90,
      step: 'verify',
      label: '静的チェック・診断結果を整理中...',
      detail: lastFile ? `生成済みファイル: ${lastFile}` : `受信データ: ${len.toLocaleString()} 文字`,
    };
  }
  if (rawText.includes('"fileChanges"')) {
    const dynamicPct = Math.min(86, 55 + Math.floor(len / 120));
    return {
      percent: dynamicPct,
      step: 'coding',
      label: lastFile ? `コードを生成中: ${lastFile}` : 'コード変更を構築中...',
      detail: `ストリーミング受信中 (${len.toLocaleString()} 文字)`,
    };
  }
  if (rawText.includes('"plan"')) {
    return {
      percent: 48,
      step: 'planning',
      label: '実装ステップと変更計画を作成中...',
      detail: `受信データ: ${len.toLocaleString()} 文字`,
    };
  }
  if (rawText.includes('"summary"')) {
    return {
      percent: Math.min(44, 30 + Math.floor(len / 80)),
      step: 'thinking',
      label: mode === 'explain' ? 'コードの解説を生成中...' : '要件を分析して設計中...',
      detail: `受信データ: ${len.toLocaleString()} 文字`,
    };
  }

  return {
    percent: 25,
    step: 'thinking',
    label: 'AIモデルが構文・依存関係を推論中...',
    detail: len > 0 ? `応答を受信中 (${len} 文字)` : '最初のトークンを待機しています...',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, geminiConfigured: hasKey });
  });

  // Streaming SSE endpoint with real progress reporting
  app.post('/api/agent/stream', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY が設定されていません。AI Studio の Settings > Secrets パネルで API キーを設定してください。',
      });
      return;
    }

    const body = (req.body || {}) as AgentRequestBody & { quality?: 'fast' | 'deep' };
    const mode: AgentMode = body.mode === 'review' || body.mode === 'explain' ? body.mode : 'build';
    const useDeep = body.quality === 'deep';
    const modelName = useDeep ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
    const thinkingLevel = useDeep ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;

    const activeFileName = typeof body.activeFileName === 'string' ? body.activeFileName : '';
    const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];

    if (messages.length === 0) {
      res.status(400).json({ error: 'プロンプトメッセージが空です。' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    const emit = (payload: Record<string, unknown>) => {
      if (clientClosed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      emit({
        type: 'progress',
        percent: 12,
        step: 'context',
        label: 'プロジェクトのコンテキストを準備中...',
        detail: `${files.length} ファイル (${activeFileName || '新規'}) を参照しています`,
      });

      const promptPayload = buildPromptPayload(files, activeFileName, messages);

      emit({
        type: 'progress',
        percent: 22,
        step: 'thinking',
        label: 'AIエージェントへリクエストを送信中...',
        detail: `${useDeep ? '精密' : '高速'}モードで設計とコード生成を開始しています`,
      });

      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: promptPayload,
        config: {
          systemInstruction: buildSystemInstruction(mode, activeFileName),
          responseMimeType: 'application/json',
          responseSchema: agentResponseSchema,
          thinkingConfig: {
            thinkingLevel,
          },
        },
      });

      let rawText = '';
      let lastEmitTime = 0;
      let lastStep = '';

      for await (const chunk of stream) {
        if (clientClosed) break;
        const part = chunk.text || '';
        if (!part) continue;
        rawText += part;

        const now = Date.now();
        const progress = inspectStreamingProgress(rawText, mode);
        if (now - lastEmitTime >= 120 || progress.step !== lastStep) {
          lastEmitTime = now;
          lastStep = progress.step;
          emit({
            type: 'progress',
            ...progress,
          });
        }
      }

      if (clientClosed) {
        res.end();
        return;
      }

      if (!rawText.trim()) {
        emit({ type: 'error', error: 'AIエージェントから空の応答が返されました。もう一度お試しください。' });
        res.end();
        return;
      }

      emit({
        type: 'progress',
        percent: 96,
        step: 'verify',
        label: '生成結果をパース・適用準備中...',
        detail: `合計 ${rawText.length.toLocaleString()} 文字を受信しました`,
      });

      const result = parseAndNormalizeAgentJson(rawText, activeFileName);

      emit({
        type: 'progress',
        percent: 100,
        step: 'done',
        label: '完了しました',
        detail:
          result.fileChanges.length > 0
            ? `${result.fileChanges.length} 件のファイル変更を提案しました`
            : '解析・回答を生成しました',
      });

      emit({ type: 'result', data: result });
      res.end();
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      emit({ type: 'error', error: formatted.message });
      res.end();
    }
  });

  // Standard non-streaming fallback endpoint
  app.post('/api/agent', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY が設定されていません。AI Studio の Settings > Secrets パネルで API キーを設定してください。',
      });
      return;
    }

    const body = (req.body || {}) as AgentRequestBody & { quality?: 'fast' | 'deep' };
    const mode: AgentMode = body.mode === 'review' || body.mode === 'explain' ? body.mode : 'build';
    const useDeep = body.quality === 'deep';
    const activeFileName = typeof body.activeFileName === 'string' ? body.activeFileName : '';
    const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];

    if (messages.length === 0) {
      res.status(400).json({ error: 'プロンプトメッセージが空です。' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: useDeep ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite',
        contents: buildPromptPayload(files, activeFileName, messages),
        config: {
          systemInstruction: buildSystemInstruction(mode, activeFileName),
          responseMimeType: 'application/json',
          responseSchema: agentResponseSchema,
          thinkingConfig: {
            thinkingLevel: useDeep ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AIエージェントから空の応答が返されました。' });
        return;
      }

      res.json(parseAndNormalizeAgentJson(rawText, activeFileName));
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`KodoBench server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
