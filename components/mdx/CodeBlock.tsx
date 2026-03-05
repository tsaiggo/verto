'use client';

import { useRef, useState, useCallback, type ComponentPropsWithoutRef } from 'react';

/**
 * CodeBlock — wraps `<pre>` output from Shiki with a header bar
 * containing a language label and a copy-to-clipboard button.
 */
export default function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Extract language from data-language attr or child <code> className
  const lang = extractLanguage(props);

  const handleCopy = useCallback(async () => {
    const text = preRef.current?.textContent ?? '';
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

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button
          type="button"
          className={`copy-btn${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <>
              {/* Check icon */}
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
              Copied!
            </>
          ) : (
            <>
              {/* Copy icon */}
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
              Copy
            </>
          )}
        </button>
      </div>
      <pre ref={preRef} {...props} />
    </div>
  );
}

/** Try to pull a language string from props or child code element */
function extractLanguage(
  props: ComponentPropsWithoutRef<'pre'>,
): string {
  // 1. data-language attribute (set by Shiki)
  const dataLang = (props as Record<string, unknown>)['data-language'];
  if (typeof dataLang === 'string' && dataLang) return dataLang;

  // 2. className on the <code> child  (e.g. "language-typescript")
  const children = props.children as React.ReactElement<{
    className?: string;
  }> | undefined;
  const cls = children?.props?.className ?? '';
  const match = /language-(\w+)/.exec(cls);
  if (match) return match[1];

  return '';
}
