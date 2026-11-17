import React, { useEffect, useMemo, useRef, useState } from 'react';
import { highlightCodeToHtml } from '../lib/analyzer';
import { SupportedLanguage } from '../types/workspace';

interface CodeEditorProps {
  value: string;
  language: SupportedLanguage;
  onChange: (nextValue: string) => void;
  isDark: boolean;
  focusLine?: number | null;
  onCursorChange?: (line: number, col: number) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  onChange,
  isDark,
  focusLine,
  onCursorChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState<number>(1);

  const lines = useMemo(() => value.split('\n'), [value]);
  const highlightedHtml = useMemo(
    () => highlightCodeToHtml(value, language, isDark) + '\n',
    [value, language, isDark]
  );

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  useEffect(() => {
    if (focusLine && focusLine > 0 && textareaRef.current) {
      const isMobile = window.innerWidth < 768;
      const lineHeight = isMobile ? 24 : 22;
      const targetTop = Math.max(0, (focusLine - 3) * lineHeight);
      textareaRef.current.scrollTop = targetTop;
      syncScroll();
      setActiveLine(focusLine);
    }
  }, [focusLine]);

  const updateCursorPosition = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart || 0;
    const before = ta.value.slice(0, pos);
    const split = before.split('\n');
    const line = split.length;
    const col = split[split.length - 1].length + 1;
    setActiveLine(line);
    if (onCursorChange) {
      onCursorChange(line, col);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const indent = language === 'luau' ? '\t' : '  ';
      const nextValue = value.slice(0, start) + indent + value.slice(end);
      onChange(nextValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + indent.length;
          textareaRef.current.selectionEnd = start + indent.length;
        }
      });
    }
  };

  const sharedMetricsStyle: React.CSSProperties = {
    tabSize: 2,
    fontVariantLigatures: 'none',
    letterSpacing: 0,
  };

  return (
    <div
      className={`relative flex h-full w-full overflow-hidden font-mono text-[16px] leading-[24px] md:text-[13px] md:leading-[22px] ${
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'
      }`}
    >
      {/* Line number gutter */}
      <div
        ref={gutterRef}
        aria-hidden="true"
        className={`w-11 md:w-12 shrink-0 select-none overflow-hidden border-r py-3 pr-2.5 text-right tabular-nums ${
          isDark
            ? 'border-slate-800 bg-slate-950 text-slate-600'
            : 'border-slate-200 bg-slate-50/70 text-slate-400'
        }`}
      >
        {lines.map((_, i) => {
          const lineNum = i + 1;
          const isCurrent = lineNum === activeLine;
          return (
            <div
              key={lineNum}
              className={`h-[24px] md:h-[22px] ${
                isCurrent
                  ? isDark
                    ? 'text-slate-200 font-semibold'
                    : 'text-slate-900 font-semibold'
                  : ''
              }`}
            >
              {lineNum}
            </div>
          );
        })}
      </div>

      {/* Synchronized highlighted code layer + transparent editable textarea */}
      <div className="relative flex-1 overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 font-mono text-[16px] leading-[24px] md:text-[13px] md:leading-[22px]"
          style={sharedMetricsStyle}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateCursorPosition();
          }}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="コードエディタ"
          className={`code-input ide-scroll relative z-10 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-[16px] leading-[24px] md:text-[13px] md:leading-[22px] text-transparent focus:outline-none ${
            isDark ? 'caret-blue-400' : 'caret-blue-600'
          }`}
          style={sharedMetricsStyle}
        />
      </div>
    </div>
  );
};
