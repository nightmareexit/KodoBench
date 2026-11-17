import { ProjectTemplate } from '../types/workspace';

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'web-sprint-board',
    title: 'スプリントタスク管理ボード',
    category: 'web',
    summary: 'HTML・CSS・バニラJSで構成された、優先度フィルタとタスク追加機能を備えた実践的な開発ボード。',
    languages: ['html', 'css', 'javascript'],
    defaultActiveFile: 'index.html',
    suggestedPrompts: [
      'タスクを「未着手 / 進行中 / 完了」の3カラムに移動できるボタンを追加して',
      '現在のJavaScriptコードのバグや改善点をレビューして修正案を出して',
      'LocalStorageにタスクを自動保存する機能を追加して',
    ],
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sprint Tracker</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div>
        <h1>Sprint 14 開発タスク</h1>
        <p class="subtitle">Web・Luau チームの進行中バックログ</p>
      </div>
      <div class="filters" role="group" aria-label="優先度フィルタ">
        <button class="filter-btn active" data-filter="all">すべて</button>
        <button class="filter-btn" data-filter="high">高優先</button>
        <button class="filter-btn" data-filter="normal">通常</button>
      </div>
    </header>

    <form id="task-form" class="composer">
      <input id="task-title" type="text" placeholder="新しいタスクを入力（例: PlayerData型定義の厳格化）" required />
      <select id="task-priority">
        <option value="normal">通常</option>
        <option value="high">高優先</option>
      </select>
      <button type="submit">追加する</button>
    </form>

    <ul id="task-list" class="task-list"></ul>
  </main>
  <script src="./app.js"></script>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  padding: 24px;
}

.shell {
  max-width: 720px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
}

h1 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.filters {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: #e2e8f0;
  border-radius: 8px;
}

.filter-btn {
  border: 0;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}

.filter-btn.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.composer {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.composer input,
.composer select {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--surface);
}

.composer input { flex: 1; }

.composer button {
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.task-item:last-child { border-bottom: 0; }

.task-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-done {
  text-decoration: line-through;
  color: var(--muted);
}

.task-meta {
  font-size: 12px;
  color: var(--muted);
}

.task-meta.high {
  color: #dc2626;
  font-weight: 600;
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `const tasks = [
  { id: 1, title: 'DataStore 保存リトライ処理の実装', priority: 'high', done: false },
  { id: 2, title: 'レスポンシブナビゲーションの余白調整', priority: 'normal', done: true },
  { id: 3, title: 'Luau CoinService の --!strict 型検査', priority: 'high', done: false },
];

let activeFilter = 'all';

const listEl = document.getElementById('task-list');
const formEl = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const prioritySelect = document.getElementById('task-priority');
const filterBtns = document.querySelectorAll('.filter-btn');

function render() {
  listEl.innerHTML = '';
  const visible = tasks.filter((item) => activeFilter === 'all' || item.priority === activeFilter);

  visible.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const main = document.createElement('label');
    main.className = 'task-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      console.log('Task toggled:', task.title, task.done);
      render();
    });

    const span = document.createElement('span');
    span.textContent = task.title;
    if (task.done) span.className = 'task-done';

    main.appendChild(checkbox);
    main.appendChild(span);

    const meta = document.createElement('span');
    meta.className = 'task-meta ' + (task.priority === 'high' ? 'high' : '');
    meta.textContent = task.priority === 'high' ? '高優先' : '通常';

    li.appendChild(main);
    li.appendChild(meta);
    listEl.appendChild(li);
  });
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  tasks.unshift({
    id: Date.now(),
    title,
    priority: prioritySelect.value,
    done: false,
  });
  console.log('Task added:', title);
  titleInput.value = '';
  render();
});

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter || 'all';
    filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
});

render();`,
      },
    ],
  },
  {
    id: 'luau-coin-service',
    title: 'Luau コイン収集 & DataStore システム',
    category: 'luau',
    summary: '--!strict 型注釈、CollectionService、DataStoreService を用いた本番品質の Roblox ServerScript / LocalScript 構成。',
    languages: ['luau'],
    defaultActiveFile: 'CoinService.server.luau',
    suggestedPrompts: [
      'コイン取得時にコンボ倍率（2秒以内の連続取得でボーナス）を計算するロジックを追加して',
      'この Luau コードをレビューして、エラーハンドリングやメモリリークの懸念点を修正して',
      'CoinTypes.luau にデイリーボーナス用の型定義と関数を追加して',
    ],
    files: [
      {
        name: 'CoinTypes.luau',
        language: 'luau',
        content: `--!strict

export type PlayerEconomyData = {
	coins: number,
	totalCollected: number,
	lastClaimTimestamp: number,
}

export type CoinSpawnConfig = {
	value: number,
	respawnSeconds: number,
	tagName: string,
}

local CoinTypes = {}

function CoinTypes.createDefaultData(): PlayerEconomyData
	return {
		coins = 0,
		totalCollected = 0,
		lastClaimTimestamp = 0,
	}
end

return CoinTypes`,
      },
      {
        name: 'CoinService.server.luau',
        language: 'luau',
        content: `--!strict
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CoinTypes = require(script.Parent.CoinTypes)
type PlayerEconomyData = CoinTypes.PlayerEconomyData

local coinStore = DataStoreService:GetDataStore("PlayerEconomy_v1")
local CONFIG: CoinTypes.CoinSpawnConfig = {
	value = 10,
	respawnSeconds = 6,
	tagName = "CollectibleCoin",
}

local playerCache: { [Player]: PlayerEconomyData } = {}
local activeCooldowns: { [BasePart]: boolean } = {}

local function setupLeaderstats(player: Player, data: PlayerEconomyData)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local coinsValue = Instance.new("IntValue")
	coinsValue.Name = "Coins"
	coinsValue.Value = data.coins
	coinsValue.Parent = leaderstats
end

local function loadPlayerData(player: Player)
	local key = "player_" .. tostring(player.UserId)
	local success, result = pcall(function()
		return coinStore:GetAsync(key)
	end)

	local data: PlayerEconomyData = if success and type(result) == "table"
		then result :: PlayerEconomyData
		else CoinTypes.createDefaultData()

	playerCache[player] = data
	setupLeaderstats(player, data)
end

local function savePlayerData(player: Player)
	local data = playerCache[player]
	if not data then
		return
	end

	local key = "player_" .. tostring(player.UserId)
	local ok, err = pcall(function()
		coinStore:SetAsync(key, data)
	end)
	if not ok then
		warn("[CoinService] Save failed:", err)
	end
	playerCache[player] = nil
end

local function bindCoinPart(part: Instance)
	if not part:IsA("BasePart") then
		return
	end

	local conn: RBXScriptConnection
	conn = part.Touched:Connect(function(hit: BasePart)
		if activeCooldowns[part] then
			return
		end
		local character = hit.Parent
		local player = if character then Players:GetPlayerFromCharacter(character) else nil
		if not player or not playerCache[player] then
			return
		end

		activeCooldowns[part] = true
		part.Transparency = 0.85
		part.CanTouch = false

		local data = playerCache[player]
		data.coins += CONFIG.value
		data.totalCollected += 1

		local leaderstats = player:FindFirstChild("leaderstats")
		local coinsInt = if leaderstats then leaderstats:FindFirstChild("Coins") else nil
		if coinsInt and coinsInt:IsA("IntValue") then
			coinsInt.Value = data.coins
		end

		task.delay(CONFIG.respawnSeconds, function()
			if part.Parent then
				part.Transparency = 0
				part.CanTouch = true
			end
			activeCooldowns[part] = nil
		end)
	end)

	part.Destroying:Connect(function()
		conn:Disconnect()
		activeCooldowns[part] = nil
	end)
end

Players.PlayerAdded:Connect(loadPlayerData)
Players.PlayerRemoving:Connect(savePlayerData)

for _, instance in CollectionService:GetTagged(CONFIG.tagName) do
	bindCoinPart(instance)
end
CollectionService:GetInstanceAddedSignal(CONFIG.tagName):Connect(bindCoinPart)`,
      },
      {
        name: 'CoinHud.client.luau',
        language: 'luau',
        content: `--!strict
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local localPlayer = Players.LocalPlayer
local playerGui = localPlayer:WaitForChild("PlayerGui")

local function attachCounter(coinsValue: IntValue, label: TextLabel)
	local currentDisplay = coinsValue.Value
	label.Text = tostring(currentDisplay)

	coinsValue.Changed:Connect(function(newValue: number)
		label.Text = tostring(newValue)
		local tween = TweenService:Create(
			label,
			TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ TextSize = 26 }
		)
		tween:Play()
		task.delay(0.18, function()
			TweenService:Create(label, TweenInfo.new(0.15), { TextSize = 22 }):Play()
		end)
	end)
end

local leaderstats = localPlayer:WaitForChild("leaderstats")
local coins = leaderstats:WaitForChild("Coins") :: IntValue
local hud = playerGui:FindFirstChild("MainHud")
if hud then
	local counterLabel = hud:FindFirstChild("CoinLabel", true)
	if counterLabel and counterLabel:IsA("TextLabel") then
		attachCounter(coins, counterLabel)
	end
end`,
      },
    ],
  },
  {
    id: 'web-canvas-particles',
    title: 'Canvas 2D パーティクル物理スタジオ',
    category: 'web',
    summary: 'HTML5 Canvas と requestAnimationFrame を使い、カーソル引力・反発をリアルタイム制御できる実験テンプレート。',
    languages: ['html', 'css', 'javascript'],
    defaultActiveFile: 'app.js',
    suggestedPrompts: [
      'パーティクル同士が一定距離以内にあるとき細い線で結ぶネットワーク効果を追加して',
      '重力オン/オフのトグルボタンとパーティクル数スライダーをUIに追加して',
      'このCanvasアニメーションの仕組みを初心者向けに解説して',
    ],
    files: [
      {
        name: 'index.html',
        language: 'html',
        content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas Particle Lab</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div class="stage-wrap">
    <div class="hud">
      <span class="title">Canvas 2D Particle Field</span>
      <button id="burst-btn" type="button">中心からバースト</button>
    </div>
    <canvas id="stage"></canvas>
  </div>
  <script src="./app.js"></script>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `* { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  background: #0f172a;
  color: #f8fafc;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}
.stage-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.hud {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}
.title {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}
#burst-btn {
  pointer-events: auto;
  border: 1px solid #334155;
  background: #1e293b;
  color: #f8fafc;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
#burst-btn:hover { background: #334155; }
canvas {
  display: block;
  width: 100%;
  height: 100%;
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const burstBtn = document.getElementById('burst-btn');

const pointer = { x: -999, y: -999, active: false };
const particles = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnParticles(count, cx, cy) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 2.2;
    particles.push({
      x: cx ?? Math.random() * canvas.width,
      y: cy ?? Math.random() * canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 2.5,
      hue: 205 + Math.random() * 35,
    });
  }
}

function tick() {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    if (pointer.active) {
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4 && dist < 140) {
        p.vx += (dx / dist) * 0.14;
        p.vy += (dy / dist) * 0.14;
      }
    }

    p.vx *= 0.99;
    p.vy *= 0.99;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(' + p.hue + ', 85%, 64%)';
    ctx.fill();
  }

  requestAnimationFrame(tick);
}

canvas.addEventListener('mousemove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
});

canvas.addEventListener('mouseleave', () => {
  pointer.active = false;
});

burstBtn.addEventListener('click', () => {
  spawnParticles(24, canvas.width / 2, canvas.height / 2);
  console.log('Burst spawned. Total particles:', particles.length);
});

window.addEventListener('resize', resize);
resize();
spawnParticles(65);
tick();`,
      },
    ],
  },
  {
    id: 'luau-inventory-module',
    title: 'Luau モジュラーインベントリ & Signal',
    category: 'luau',
    summary: 'ジェネリック風型付き Signal モジュールと、スタック上限付きインベントリクラス（OOP パターン）のテンプレート。',
    languages: ['luau'],
    defaultActiveFile: 'InventoryManager.luau',
    suggestedPrompts: [
      'アイテムのレアリティ（Common / Rare / Epic）とフィルタ検索メソッドを追加して',
      'Luau のメタテーブル OOP と `--!strict` 型定義の関係を解説して',
      'アイテム消費時にクールダウンを管理する仕組みを追加して',
    ],
    files: [
      {
        name: 'InventoryManager.luau',
        language: 'luau',
        content: `--!strict

export type ItemStack = {
	id: string,
	name: string,
	quantity: number,
	maxStack: number,
}

export type Inventory = {
	capacity: number,
	slots: { ItemStack },
	addItem: (self: Inventory, id: string, name: string, amount: number, maxStack: number?) -> boolean,
	removeItem: (self: Inventory, id: string, amount: number) -> boolean,
	getTotalCount: (self: Inventory, id: string) -> number,
}

local InventoryManager = {}
InventoryManager.__index = InventoryManager

function InventoryManager.new(capacity: number): Inventory
	local self = setmetatable({
		capacity = capacity,
		slots = {} :: { ItemStack },
	}, InventoryManager)
	return (self :: any) :: Inventory
end

function InventoryManager:addItem(id: string, name: string, amount: number, maxStack: number?): boolean
	if amount <= 0 then
		return false
	end

	local limit = maxStack or 99
	local remaining = amount

	for _, slot in self.slots do
		if slot.id == id and slot.quantity < slot.maxStack then
			local space = slot.maxStack - slot.quantity
			local transfer = math.min(space, remaining)
			slot.quantity += transfer
			remaining -= transfer
			if remaining == 0 then
				return true
			end
		end
	end

	while remaining > 0 do
		if #self.slots >= self.capacity then
			return false
		end
		local chunk = math.min(limit, remaining)
		table.insert(self.slots, {
			id = id,
			name = name,
			quantity = chunk,
			maxStack = limit,
		})
		remaining -= chunk
	end

	return true
end

function InventoryManager:removeItem(id: string, amount: number): boolean
	if self:getTotalCount(id) < amount then
		return false
	end

	local remaining = amount
	for i = #self.slots, 1, -1 do
		local slot = self.slots[i]
		if slot.id == id then
			local take = math.min(slot.quantity, remaining)
			slot.quantity -= take
			remaining -= take
			if slot.quantity == 0 then
				table.remove(self.slots, i)
			end
			if remaining == 0 then
				break
			end
		end
	end

	return true
end

function InventoryManager:getTotalCount(id: string): number
	local total = 0
	for _, slot in self.slots do
		if slot.id == id then
			total += slot.quantity
		end
	end
	return total
end

return InventoryManager`,
      },
    ],
  },
];
