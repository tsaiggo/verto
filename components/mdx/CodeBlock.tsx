'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ComponentPropsWithoutRef,
} from 'react';

const COLLAPSE_LINE_THRESHOLD = 30;

/**
 * CodeBlock — wraps `<pre>` output from Shiki with a header bar
 * containing a (filename / language) label and a copy-to-clipboard button.
 *
 * Reads `data-*` attributes set by Shiki + our `verto:code-meta` transformer:
 *   - `data-language`     → language label
 *   - `data-title`        → macOS-style filename badge
 *   - `data-line-numbers` → render line numbers via CSS counter
 *   - `data-no-copy`      → hide the copy button
 */
export default function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lang = extractLanguage(props);
  const title = (props as { 'data-title'?: string })['data-title'];
  const showLineNumbers =
    (props as { 'data-line-numbers'?: string })['data-line-numbers'] === 'true';
  const noCopy =
    (props as { 'data-no-copy'?: string })['data-no-copy'] === 'true';

  // Decide whether to allow collapse based on rendered line count.
  // Counted from real DOM after mount — Shiki produces one `.line` span per row.
  // Using a one-shot `requestAnimationFrame` callback (rather than a synchronous
  // setState inside the effect body) keeps React's
  // `react-hooks/set-state-in-effect` rule happy.
  useEffect(() => {
    const el = preRef.current;
    if (!el) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      const lines = el.querySelectorAll('.line').length;
      if (lines > COLLAPSE_LINE_THRESHOLD) setCollapsible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCopy = useCallback(async () => {
    const el = preRef.current;
    if (!el) return;
    // Strip Shiki notation comment markers from the copied text so users
    // don't paste `// [!code ++]` etc. into their own files.
    const text = stripNotationComments(el.textContent ?? '');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const wrapClass = [
    'code-block',
    showLineNumbers ? 'has-line-numbers' : '',
    collapsible && !expanded ? 'is-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <div className="code-block-header">
        <div className="code-block-title">
          {title ? (
            <span className="code-title">{title}</span>
          ) : (
            <span className="code-lang">{lang}</span>
          )}
          {title && lang && <span className="code-lang-badge">{lang}</span>}
        </div>
        {!noCopy && (
          <button
            type="button"
            className={`copy-btn${copied ? ' copied' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? (
              <>
                <CheckIcon /> Copied!
              </>
            ) : (
              <>
                <CopyIcon /> Copy
              </>
            )}
          </button>
        )}
      </div>
      <div className="code-block-body">
        <pre ref={preRef} {...props} />
      </div>
      {collapsible && (
        <button
          type="button"
          className="code-block-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

/** Try to pull a language string from props or child code element */
function extractLanguage(props: ComponentPropsWithoutRef<'pre'>): string {
  const dataLang = (props as { 'data-language'?: string })['data-language'];
  if (typeof dataLang === 'string' && dataLang) return dataLang;

  const child = props.children;
  const cls =
    child && typeof child === 'object' && 'props' in child
      ? (child as React.ReactElement<{ className?: string }>).props?.className ??
        ''
      : '';
  const match = /language-(\w+)/.exec(cls);
  if (match) return match[1];

  return '';
}

/**
 * Remove Shiki notation comment markers like `// [!code ++]`,
 * `# [!code highlight]`, `<!-- [!code focus] -->`, etc., that the
 * transformers leave inside the code text. Keep everything else intact.
 *
 * NOTE: This operates on the line-by-line **rendered text content** of a
 * Shiki `<pre>`, where notation comments are guaranteed to be real comments
 * (Shiki only recognises them in real comment positions). It is therefore
 * safe to apply to such text, but should not be used on arbitrary source
 * containing string literals that happen to look like notation comments.
 */
export function stripNotationComments(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(
          /\s*(?:\/\/|#|--|;|<!--)\s*\[!code\s+[^\]]+\](?:\s*-->)?\s*$/,
          '',
        )
        .replace(/\s*\/\*\s*\[!code\s+[^\]]+\]\s*\*\/\s*$/, ''),
    )
    .join('\n');
}
