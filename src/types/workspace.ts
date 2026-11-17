export type SupportedLanguage = 'html' | 'css' | 'javascript' | 'luau';

export type PlatformView = 'overview' | 'workspace' | 'templates' | 'reference';

export type AgentMode = 'build' | 'review' | 'explain';

export interface ProjectFile {
  name: string;
  language: SupportedLanguage;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  category: 'web' | 'luau';
  summary: string;
  languages: SupportedLanguage[];
  files: ProjectFile[];
  defaultActiveFile: string;
  suggestedPrompts: string[];
}

export interface FilePatch {
  path: string;
  language: SupportedLanguage;
  action: 'create' | 'update';
  content: string;
  rationale: string;
  applied?: boolean;
}

export interface DiagnosticItem {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: AgentMode;
  plan?: string[];
  fileChanges?: FilePatch[];
  diagnostics?: DiagnosticItem[];
  error?: boolean;
  timestamp: string;
}

export interface ConsoleLogEntry {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info';
  text: string;
  timestamp: string;
}

export interface OutlineSymbol {
  name: string;
  kind: 'function' | 'type' | 'service' | 'selector' | 'element';
  line: number;
}
