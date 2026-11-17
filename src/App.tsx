import { useEffect, useState } from 'react';
import { PlatformOverview } from './components/PlatformOverview';
import { ReferenceView } from './components/ReferenceView';
import { TemplatesView } from './components/TemplatesView';
import { TopBar } from './components/TopBar';
import { WorkspaceIDE } from './components/WorkspaceIDE';
import { ReferenceItem } from './data/reference';
import { PROJECT_TEMPLATES } from './data/templates';
import { PlatformView, ProjectFile, ProjectTemplate } from './types/workspace';

export default function App() {
  const [activeView, setActiveView] = useState<PlatformView>('overview');
  const [isDark, setIsDark] = useState(false);

  // Active Workspace Project State (defaults to Web Sprint Board)
  const initialTemplate = PROJECT_TEMPLATES[0];
  const [projectTitle, setProjectTitle] = useState<string>(initialTemplate.title);
  const [files, setFiles] = useState<ProjectFile[]>(() =>
    initialTemplate.files.map((f) => ({ ...f }))
  );
  const [activeFileName, setActiveFileName] = useState<string>(initialTemplate.defaultActiveFile);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(
    initialTemplate.suggestedPrompts
  );
  const [pendingAutoPrompt, setPendingAutoPrompt] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const handleLoadTemplate = (template: ProjectTemplate) => {
    setProjectTitle(template.title);
    setFiles(template.files.map((f) => ({ ...f })));
    setActiveFileName(template.defaultActiveFile);
    setSuggestedPrompts(template.suggestedPrompts);
    setActiveView('workspace');
  };

  const handleCreateBlankProject = () => {
    setProjectTitle('新規マルチ言語プロジェクト');
    setFiles([
      {
        name: 'index.html',
        language: 'html',
        content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KodoBench App</title>
</head>
<body>
  <main class="container">
    <h1>KodoBench プロジェクト</h1>
    <p>右側の AI エージェントに作りたい機能を指示してください。</p>
  </main>
</body>
</html>`,
      },
      {
        name: 'styles.css',
        language: 'css',
        content: `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}
.container {
  max-width: 720px;
  margin: 40px auto;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}`,
      },
      {
        name: 'app.js',
        language: 'javascript',
        content: `console.log('KodoBench workspace ready');`,
      },
      {
        name: 'Main.server.luau',
        language: 'luau',
        content: `--!strict
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player: Player)
	print("Welcome,", player.Name)
end)`,
      },
    ]);
    setActiveFileName('index.html');
    setSuggestedPrompts([
      'HTML/CSS/JS でレスポンシブなポモドーロタイマーを実装して',
      'Main.server.luau にプレイヤー参加時のステータス初期化処理を追加して',
      'このプロジェクト全体の構成と改善点をレビューして',
    ]);
    setActiveView('workspace');
  };

  const handleLaunchWithPrompt = (prompt: string, targetStack: 'web' | 'luau') => {
    const baseTemplate =
      PROJECT_TEMPLATES.find((t) => t.category === targetStack) || PROJECT_TEMPLATES[0];
    setProjectTitle(
      targetStack === 'luau' ? 'AI生成 Luau プロジェクト' : 'AI生成 Web プロジェクト'
    );
    setFiles(baseTemplate.files.map((f) => ({ ...f })));
    setActiveFileName(baseTemplate.defaultActiveFile);
    setSuggestedPrompts(baseTemplate.suggestedPrompts);
    setPendingAutoPrompt(prompt);
    setActiveView('workspace');
  };

  const handleOpenSnippetInWorkspace = (item: ReferenceItem) => {
    setProjectTitle(`スニペット: ${item.title}`);
    setFiles([
      {
        name: item.filename,
        language: item.language,
        content: item.code,
      },
    ]);
    setActiveFileName(item.filename);
    setSuggestedPrompts([
      `${item.filename} のコードを分かりやすく解説して`,
      `${item.filename} をベースに実用的な機能を追加して`,
      `${item.filename} の静的チェックと型安全性をレビューして`,
    ]);
    setActiveView('workspace');
  };

  return (
    <div
      className={`flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        activeView === 'workspace' ? 'h-dvh overflow-hidden' : 'min-h-dvh'
      }`}
    >
      <TopBar
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onNewProject={handleCreateBlankProject}
      />

      <main className="flex-1 min-h-0 flex flex-col">
        {activeView === 'overview' && (
          <PlatformOverview
            onOpenWorkspace={() => setActiveView('workspace')}
            onLaunchWithPrompt={handleLaunchWithPrompt}
            onLoadTemplate={handleLoadTemplate}
            onNavigate={(view) => setActiveView(view)}
          />
        )}

        {activeView === 'workspace' && (
          <WorkspaceIDE
            projectTitle={projectTitle}
            files={files}
            activeFileName={activeFileName}
            suggestedPrompts={suggestedPrompts}
            isDark={isDark}
            onToggleDark={() => setIsDark((d) => !d)}
            onFilesChange={setFiles}
            onActiveFileChange={setActiveFileName}
            onOpenTemplateDrawer={() => setActiveView('templates')}
            pendingAutoPrompt={pendingAutoPrompt}
            onConsumePendingPrompt={() => setPendingAutoPrompt(null)}
          />
        )}

        {activeView === 'templates' && (
          <TemplatesView onLoadTemplate={handleLoadTemplate} />
        )}

        {activeView === 'reference' && (
          <ReferenceView onOpenSnippetInWorkspace={handleOpenSnippetInWorkspace} />
        )}
      </main>
    </div>
  );
}
