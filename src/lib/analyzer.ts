import { DiagnosticItem, OutlineSymbol, ProjectFile, SupportedLanguage } from '../types/workspace';

export function inferLanguageFromFilename(filename: string): SupportedLanguage {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.luau') || lower.endsWith('.lua')) return 'luau';
  return 'javascript';
}

export function getLanguageLabel(lang: SupportedLanguage): string {
  switch (lang) {
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    case 'javascript':
      return 'JavaScript';
    case 'luau':
      return 'Luau';
  }
}

export function extractOutline(file: ProjectFile): OutlineSymbol[] {
  const lines = file.content.split('\n');
  const symbols: OutlineSymbol[] = [];

  if (file.language === 'luau') {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const typeMatch = line.match(/^\s*(?:export\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (typeMatch) {
        symbols.push({ name: `type ${typeMatch[1]}`, kind: 'type', line: lineNum });
        return;
      }
      const serviceMatch = line.match(/game:GetService\(\s*["']([A-Za-z0-9_]+)["']\s*\)/);
      if (serviceMatch) {
        symbols.push({ name: serviceMatch[1], kind: 'service', line: lineNum });
        return;
      }
      const fnMatch = line.match(/^\s*(?:local\s+)?function\s+([A-Za-z_][A-Za-z0-9_.:]*)\s*\(/);
      if (fnMatch) {
        symbols.push({ name: `${fnMatch[1]}()`, kind: 'function', line: lineNum });
      }
    });
  } else if (file.language === 'javascript') {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const fnDecl = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (fnDecl) {
        symbols.push({ name: `${fnDecl[1]}()`, kind: 'function', line: lineNum });
        return;
      }
      const arrowDecl = line.match(/^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
      if (arrowDecl) {
        symbols.push({ name: `${arrowDecl[1]}()`, kind: 'function', line: lineNum });
        return;
      }
      const classDecl = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (classDecl) {
        symbols.push({ name: `class ${classDecl[1]}`, kind: 'type', line: lineNum });
      }
    });
  } else if (file.language === 'css') {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const selMatch = line.match(/^\s*([.#@][A-Za-z0-9_-][^{,]*)\s*\{/);
      if (selMatch) {
        symbols.push({ name: selMatch[1].trim(), kind: 'selector', line: lineNum });
      }
    });
  } else if (file.language === 'html') {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const idMatch = line.match(/<([a-zA-Z0-9-]+)[^>]*\bid=["']([^"']+)["']/);
      if (idMatch) {
        symbols.push({ name: `${idMatch[1]}#${idMatch[2]}`, kind: 'element', line: lineNum });
      }
    });
  }

  return symbols.slice(0, 32);
}

export function analyzeFile(file: ProjectFile): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = file.content.split('\n');

  if (file.language === 'luau') {
    const firstNonEmpty = lines.find((l) => l.trim().length > 0)?.trim() || '';
    if (!firstNonEmpty.startsWith('--!strict') && !firstNonEmpty.startsWith('--!nonstrict')) {
      diagnostics.push({
        file: file.name,
        line: 1,
        severity: 'info',
        message: '先頭に `--!strict` を追加すると Luau の厳格な静的型チェックが有効になります。',
      });
    }

    let blockDepth = 0;
    let hasConnect = false;
    let hasDisconnect = false;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      // Strip single-line comment
      const commentIdx = rawLine.indexOf('--');
      const codePart = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;

      if (/\bwait\s*\(/.test(codePart) && !/task\.wait\s*\(/.test(codePart)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '非推奨の `wait()` が検出されました。`task.wait()` の使用を推奨します。',
        });
      }
      if (/\bspawn\s*\(/.test(codePart) && !/task\.spawn\s*\(/.test(codePart)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '非推奨の `spawn()` が検出されました。`task.spawn()` を使用してください。',
        });
      }
      if (/\bdelay\s*\(/.test(codePart) && !/task\.delay\s*\(/.test(codePart)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '非推奨の `delay()` が検出されました。`task.delay()` を使用してください。',
        });
      }
      if (/\bypcall\s*\(/.test(codePart)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '`ypcall()` は非推奨です。`pcall()` を使用してください。',
        });
      }
      if (/\bgame\.(Workspace|Players|ReplicatedStorage|TweenService|RunService)\b/.test(codePart)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'info',
          message: 'サービス取得には直接参照ではなく `game:GetService(...)` の使用を推奨します。',
        });
      }

      if (/:Connect\s*\(/.test(codePart)) hasConnect = true;
      if (/:Disconnect\s*\(/.test(codePart) || /\bDestroying\b/.test(codePart)) hasDisconnect = true;

      // Rough block balance check (strip strings first)
      const noStrings = codePart.replace(/"[^"]*"|'[^']*'/g, '');
      const openers = noStrings.match(/\b(function|then|do|repeat)\b/g);
      const closers = noStrings.match(/\b(end|until)\b/g);
      if (openers) blockDepth += openers.length;
      if (closers) blockDepth -= closers.length;
      if (blockDepth < 0) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'error',
          message: '対応する開始ブロックのない `end` または `until` が見つかりました。',
        });
        blockDepth = 0;
      }
    });

    if (blockDepth > 0) {
      diagnostics.push({
        file: file.name,
        line: lines.length,
        severity: 'error',
        message: `閉じられていないブロックが ${blockDepth} 箇所あります（\`end\` が不足している可能性があります）。`,
      });
    }

    if (hasConnect && !hasDisconnect && lines.length > 15) {
      diagnostics.push({
        file: file.name,
        line: 1,
        severity: 'info',
        message: '`:Connect()` の接続解除（`:Disconnect()`）または破棄処理を確認してください。',
      });
    }
  } else if (file.language === 'javascript') {
    let braceBalance = 0;
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const noComment = rawLine.replace(/\/\/.*$/, '');
      if (/\bvar\s+/.test(noComment)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '`var` の代わりにブロックスコープの `const` または `let` を使用してください。',
        });
      }
      if (/document\.write\s*\(/.test(noComment)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'warning',
          message: '`document.write()` は非推奨です。DOM API (`textContent` / `append`) を使用してください。',
        });
      }
      if (/[^=!]==[^=]/.test(noComment)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'info',
          message: '厳密等価演算子 `===` の使用を推奨します。',
        });
      }
      const noStr = noComment.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '');
      for (const ch of noStr) {
        if (ch === '{') braceBalance++;
        if (ch === '}') braceBalance--;
      }
    });
    if (braceBalance !== 0) {
      diagnostics.push({
        file: file.name,
        line: lines.length,
        severity: 'error',
        message: `波括弧 \`{\` \`}\` の対応が一致していません（差分: ${braceBalance}）。`,
      });
    }
  } else if (file.language === 'css') {
    let braceBalance = 0;
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      if (/!important/.test(rawLine)) {
        diagnostics.push({
          file: file.name,
          line: lineNum,
          severity: 'info',
          message: '`!important` の多用は詳細度管理を難しくします。セレクタ設計を見直すことを検討してください。',
        });
      }
      for (const ch of rawLine) {
        if (ch === '{') braceBalance++;
        if (ch === '}') braceBalance--;
      }
    });
    if (braceBalance !== 0) {
      diagnostics.push({
        file: file.name,
        line: lines.length,
        severity: 'error',
        message: 'CSS ブロックの `{` と `}` の数が一致していません。',
      });
    }
  } else if (file.language === 'html') {
    const trimmed = file.content.trim().toLowerCase();
    if (trimmed.length > 0 && !trimmed.includes('<!doctype html>')) {
      diagnostics.push({
        file: file.name,
        line: 1,
        severity: 'info',
        message: '標準準拠モードのため先頭に `<!doctype html>` の記述を推奨します。',
      });
    }
    lines.forEach((rawLine, idx) => {
      if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(rawLine)) {
        diagnostics.push({
          file: file.name,
          line: idx + 1,
          severity: 'warning',
          message: 'アクセシビリティのため `<img>` タグに `alt` 属性を指定してください。',
        });
      }
    });
  }

  return diagnostics;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function highlightCodeToHtml(code: string, language: SupportedLanguage, isDark: boolean): string {
  const palette = isDark
    ? {
        comment: 'text-slate-500 italic',
        string: 'text-emerald-400',
        keyword: 'text-blue-400 font-medium',
        type: 'text-amber-300',
        number: 'text-orange-300',
        tag: 'text-rose-400',
        attr: 'text-sky-300',
      }
    : {
        comment: 'text-slate-400 italic',
        string: 'text-emerald-700',
        keyword: 'text-blue-700 font-medium',
        type: 'text-amber-700',
        number: 'text-orange-700',
        tag: 'text-rose-700',
        attr: 'text-sky-700',
      };

  const tokenRegexByLang: Record<SupportedLanguage, RegExp> = {
    luau: /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|break|continue|and|or|not|true|false|nil|export|type)\b)|(\b(?:string|number|boolean|any|unknown|never|void|Instance|Vector3|Vector2|CFrame|Color3|UDim2|Player|RBXScriptConnection|task|game|script|workspace|Enum|pcall|xpcall|require|ipairs|pairs|table|math|string)\b)|(\b\d+(?:\.\d+)?\b)/g,
    javascript: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|of|in|while|switch|case|break|continue|default|class|extends|new|try|catch|finally|throw|async|await|import|export|from|typeof|instanceof|true|false|null|undefined)\b)|(\b(?:document|window|console|Math|Array|Object|Promise|Map|Set|JSON|fetch|requestAnimationFrame)\b)|(\b\d+(?:\.\d+)?\b)/g,
    css: /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[a-zA-Z-]+)|(\b[a-zA-Z-]+(?=\s*:))|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg|fr)?\b)/g,
    html: /(<!--[\s\S]*?-->)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(&lt;\/?[a-zA-Z0-9-]+|\/?&gt;)|(\b[a-zA-Z-:]+(?==))|(\b\d+\b)/g,
  };

  if (language === 'html') {
    // Highlight on already-escaped HTML so tags match &lt;tag and &gt;
    const escaped = escapeHtml(code);
    const regex = tokenRegexByLang.html;
    return escaped.replace(regex, (match, comment, str, tag, attr, num) => {
      if (comment) return `<span class="${palette.comment}">${comment}</span>`;
      if (str) return `<span class="${palette.string}">${str}</span>`;
      if (tag) return `<span class="${palette.tag}">${tag}</span>`;
      if (attr) return `<span class="${palette.attr}">${attr}</span>`;
      if (num) return `<span class="${palette.number}">${num}</span>`;
      return match;
    });
  }

  const regex = tokenRegexByLang[language];
  let result = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  regex.lastIndex = 0;

  while ((m = regex.exec(code)) !== null) {
    if (m.index > lastIndex) {
      result += escapeHtml(code.slice(lastIndex, m.index));
    }
    const [full, comment, str, kw, typ, num] = m;
    const safe = escapeHtml(full);
    if (comment) {
      result += `<span class="${palette.comment}">${safe}</span>`;
    } else if (str) {
      result += `<span class="${palette.string}">${safe}</span>`;
    } else if (kw) {
      result += `<span class="${palette.keyword}">${safe}</span>`;
    } else if (typ) {
      result += `<span class="${palette.type}">${safe}</span>`;
    } else if (num) {
      result += `<span class="${palette.number}">${safe}</span>`;
    } else {
      result += safe;
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex));
  }

  return result;
}

export function buildPreviewDocument(files: ProjectFile[]): string {
  const htmlFile =
    files.find((f) => f.language === 'html' && f.name.toLowerCase() === 'index.html') ||
    files.find((f) => f.language === 'html');

  const cssContent = files
    .filter((f) => f.language === 'css')
    .map((f) => `/* ${f.name} */\n${f.content}`)
    .join('\n\n');

  const jsContent = files
    .filter((f) => f.language === 'javascript')
    .map((f) => `// ${f.name}\n${f.content}`)
    .join('\n\n');

  const bridgeScript = `
<script>
(function() {
  function send(level, args) {
    try {
      var text = Array.prototype.slice.call(args).map(function(a) {
        if (typeof a === 'object' && a !== null) {
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      window.parent.postMessage({ source: 'kodobench-preview', level: level, text: text }, '*');
    } catch (e) {}
  }
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
  console.error = function() { send('error', arguments); origError.apply(console, arguments); };
  window.addEventListener('error', function(ev) {
    send('error', [ev.message + ' (line ' + ev.lineno + ')']);
  });
})();
</script>`;

  if (!htmlFile) {
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<style>
body { font-family: system-ui, sans-serif; padding: 32px; color: #334155; background: #f8fafc; }
.empty-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; background: #fff; }
${cssContent}
</style>
</head>
<body>
<div class="empty-box">
  <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">HTML ファイルが見つかりません</h2>
  <p style="margin:0;font-size:14px;">Web プレビューを表示するには <code>index.html</code> を作成してください。Luau ファイルのみの場合は右側の「Luau 静的解析」をご利用ください。</p>
</div>
${bridgeScript}
<script>${jsContent}</script>
</body>
</html>`;
  }

  let doc = htmlFile.content;

  // Strip external relative stylesheet/script links that correspond to workspace files so they don't 404
  files.forEach((f) => {
    if (f.language === 'css') {
      const escaped = f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      doc = doc.replace(new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${escaped}["'][^>]*>`, 'gi'), '');
    }
    if (f.language === 'javascript') {
      const escaped = f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      doc = doc.replace(new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${escaped}["'][^>]*><\\/script>`, 'gi'), '');
    }
  });

  const injectedHead = `<style>\n${cssContent}\n</style>\n${bridgeScript}`;
  const injectedBody = `<script>\ntry {\n${jsContent}\n} catch (err) {\n  console.error(err && err.message ? err.message : String(err));\n}\n</script>`;

  if (doc.includes('</head>')) {
    doc = doc.replace('</head>', `${injectedHead}\n</head>`);
  } else {
    doc = `${injectedHead}\n${doc}`;
  }

  if (doc.includes('</body>')) {
    doc = doc.replace('</body>', `${injectedBody}\n</body>`);
  } else {
    doc = `${doc}\n${injectedBody}`;
  }

  return doc;
}
