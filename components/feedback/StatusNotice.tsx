"use client";

import { Hourglass, RotateCw, TriangleAlert } from "lucide-react";
import styles from "./StatusNotice.module.css";

export type StatusNoticeTone = "pending" | "warning" | "update";

export interface StatusNoticeAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface StatusNoticeProps {
  tone: StatusNoticeTone;
  title: string;
  description?: string;
  action?: StatusNoticeAction;
  className?: string;
}

const noticeIcons = {
  pending: Hourglass,
  warning: TriangleAlert,
  update: RotateCw,
};

const toneLabels = {
  pending: "In progress",
  warning: "Needs attention",
  update: "Update",
};

/** Inline feedback for a real operation; its caller owns the status and retry action. */
export function StatusNotice({ tone, title, description, action, className }: StatusNoticeProps) {
  const Icon = noticeIcons[tone];

  return (
    <div
      className={[styles.notice, styles[tone], className].filter(Boolean).join(" ")}
      role={tone === "warning" ? "alert" : "status"}
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.content}>
        <span className={styles.eyebrow}>{toneLabels[tone]}</span>
        <strong className={styles.title}>{title}</strong>
        {description ? <p className={styles.description}>{description}</p> : null}
        {action ? (
          <button
            type="button"
            className={styles.action}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
