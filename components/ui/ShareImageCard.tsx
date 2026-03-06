'use client';

import React from 'react';
import { siteConfig } from '@/lib/site';

interface ShareImageCardProps {
  title: string;
  selectedText: string;
  author: string;
  tags: string[];
  blogUrl: string;
}

const ShareImageCard = React.forwardRef<HTMLDivElement, ShareImageCardProps>(
  function ShareImageCard({ title, selectedText, author, tags, blogUrl }, ref) {
    const truncatedText =
      selectedText.length > siteConfig.share.maxTextLength
        ? selectedText.slice(0, siteConfig.share.maxTextLength) + '\u2026'
        : selectedText;

    const fontStack =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    return (
      <div
        ref={ref}
        data-share-card
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: siteConfig.share.cardWidth,
          fontFamily: fontStack,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: 10,
          borderRadius: 16,
          boxSizing: 'border-box',
        }}
      >
        {/* Inner white card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            boxSizing: 'border-box',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.35,
              marginBottom: 20,
              fontFamily: fontStack,
            }}
          >
            {title}
          </div>

          {/* Selected text with decorative quote */}
          <div
            style={{
              position: 'relative',
              borderLeft: '4px solid #667eea',
              paddingLeft: 20,
              marginBottom: 20,
            }}
          >
            {/* Large open-quote */}
            <span
              style={{
                position: 'absolute',
                top: -8,
                left: 8,
                fontSize: 48,
                lineHeight: 1,
                color: '#2563eb',
                fontFamily: 'Georgia, serif',
                opacity: 0.25,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
              aria-hidden="true"
            >
              {'\u201C'}
            </span>

            <div
              style={{
                fontSize: 16,
                color: '#374151',
                lineHeight: 1.65,
                fontStyle: 'italic',
                fontFamily: fontStack,
              }}
            >
              {truncatedText}
            </div>
          </div>

          {/* Author */}
          <div
            style={{
              fontSize: 13,
              color: '#6b7280',
              marginBottom: 16,
              fontFamily: fontStack,
            }}
          >
            {'— '}{author}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    borderRadius: 9999,
                    fontFamily: fontStack,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: URL + branding */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e5e7eb',
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            {/* Blog URL */}
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                fontFamily: fontStack,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '65%',
              }}
            >
              {blogUrl}
            </div>

            {/* Verto branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox={siteConfig.logo.viewBox}
                fill="#9ca3af"
                style={{ flexShrink: 0 }}
              >
                <path d={siteConfig.logo.svgPath} />
              </svg>
              <span
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  fontWeight: 500,
                  fontFamily: fontStack,
                }}
              >
                {siteConfig.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareImageCard.displayName = 'ShareImageCard';

export default ShareImageCard;
