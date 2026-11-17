import { SupportedLanguage } from '../types/workspace';

export interface ReferenceItem {
  id: string;
  language: SupportedLanguage;
  title: string;
  summary: string;
  filename: string;
  code: string;
  notes: string[];
}

export const LANGUAGE_REFERENCES: ReferenceItem[] = [
  {
    id: 'luau-strict-types',
    language: 'luau',
    title: 'Luau 厳格型チェック (--!strict) と export type',
    summary: 'ModuleScript 間で安全に型を共有し、Roblox Studio の型推論エラーを未然に防ぐ基本パターン。',
    filename: 'Types.luau',
    code: `--!strict
export type WeaponStats = {
	damage: number,
	cooldown: number,
	element: "Fire" | "Ice" | "Physical",
}

local function calculateDps(stats: WeaponStats): number
	return stats.damage / math.max(stats.cooldown, 0.05)
end

return {
	calculateDps = calculateDps,
}`,
    notes: [
      'スクリプト最上行に `--!strict` を記述すると暗黙の any 推論を抑制できます。',
      'ユニオン型（"Fire" | "Ice"）を使うと分岐漏れを静的解析で検出できます。',
    ],
  },
  {
    id: 'luau-task-scheduler',
    language: 'luau',
    title: 'task ライブラリと安全な接続クリーンアップ',
    summary: '旧グローバル wait/spawn を使わず、フレーム精度の高い task.wait / task.spawn と RBXScriptConnection の切断を実装します。',
    filename: 'Lifecycle.server.luau',
    code: `--!strict
local RunService = game:GetService("RunService")

local elapsed = 0
local connection: RBXScriptConnection? = nil

connection = RunService.Heartbeat:Connect(function(dt: number)
	elapsed += dt
	if elapsed >= 5 then
		if connection then
			connection:Disconnect()
			connection = nil
		end
	end
end)

task.spawn(function()
	task.wait(1)
	print("1秒後の非同期処理が完了しました")
end)`,
    notes: [
      '`wait()` や `spawn()` はスロットリングの影響を受けるため、`task.wait()` / `task.spawn()` を使用してください。',
      '不要になった `RBXScriptConnection` は `:Disconnect()` で確実に解放します。',
    ],
  },
  {
    id: 'html-semantic-form',
    language: 'html',
    title: 'セマンティック HTML5 とアクセシブルなフォーム設計',
    summary: 'label と input の明示的関連付け、ランドマーク要素（main / section / nav）を用いた構造化テンプレート。',
    filename: 'index.html',
    code: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Semantic Form</title>
</head>
<body>
  <main>
    <section aria-labelledby="contact-heading">
      <h1 id="contact-heading">開発リクエスト送信</h1>
      <form id="request-form">
        <label for="project-name">プロジェクト名</label>
        <input id="project-name" name="projectName" type="text" required />
        <button type="submit">送信する</button>
      </form>
    </section>
  </main>
</body>
</html>`,
    notes: [
      '`for` 属性と `id` を一致させることでスクリーンリーダーとクリック領域の両方を改善できます。',
      'ボタンの意図を明確にするため `type="submit"` または `type="button"` を明記します。',
    ],
  },
  {
    id: 'css-grid-container',
    language: 'css',
    title: 'CSS Grid レスポンシブレイアウトとカスタムプロパティ',
    summary: 'メディアクエリに頼らず auto-fit と minmax() で画面幅に適応するモダンカードグリッド。',
    filename: 'styles.css',
    code: `:root {
  --surface-card: #ffffff;
  --border-hairline: #e2e8f0;
  --space-grid: 20px;
}

.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-grid);
}

.grid-card {
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
  padding: 20px;
}`,
    notes: [
      '`minmax(260px, 1fr)` により、デスクトップでは複数列、モバイルでは自動で1列に折り返します。',
      '境界線は影と1pxボーダーのどちらかに統一すると視覚ノイズを抑えられます。',
    ],
  },
  {
    id: 'js-safe-dom-fetch',
    language: 'javascript',
    title: '安全な DOM 更新と非同期 AbortController パターン',
    summary: 'innerHTML を避け textContent で安全に描画しつつ、連続リクエストの競合を AbortController で制御する実例。',
    filename: 'app.js',
    code: `let currentController = null;

async function searchItems(query) {
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(query), {
      signal: currentController.signal,
    });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const items = await response.json();
    renderList(items);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('検索に失敗しました:', err.message);
    }
  }
}

function renderList(items) {
  const list = document.getElementById('results');
  if (!list) return;
  list.replaceChildren();
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
}`,
    notes: [
      'ユーザー入力やAPI文字列の描画には `innerHTML` ではなく `textContent` を使用します。',
      '`AbortController` で古い非同期通信をキャンセルするとレースコンディションを防げます。',
    ],
  },
];
