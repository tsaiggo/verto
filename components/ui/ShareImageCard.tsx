import React from "react";
import { siteConfig } from "@/lib/site";
import { ShareImageQuote, ShareImageTags, ShareImageFooter } from "./share-image-card-parts";

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
        ? selectedText.slice(0, siteConfig.share.maxTextLength) + "\u2026"
        : selectedText;

    const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    return (
      <div
        ref={ref}
        data-share-card
        style={{
          width: siteConfig.share.cardWidth,
          fontFamily: fontStack,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: 10,
          borderRadius: 16,
          boxSizing: "border-box",
        }}
      >
        {/* Inner white card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            boxSizing: "border-box",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.35,
              marginBottom: 20,
              fontFamily: fontStack,
            }}
          >
            {title}
          </div>

          {/* Selected text with decorative quote */}
          <ShareImageQuote text={truncatedText} fontStack={fontStack} />

          {/* Author */}
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              marginBottom: 16,
              fontFamily: fontStack,
            }}
          >
            {"— "}
            {author}
          </div>

          {/* Tags */}
          <ShareImageTags tags={tags} fontStack={fontStack} />

          {/* Footer: URL + branding */}
          <ShareImageFooter blogUrl={blogUrl} fontStack={fontStack} />
        </div>
      </div>
    );
  }
);

ShareImageCard.displayName = "ShareImageCard";

export default ShareImageCard;
