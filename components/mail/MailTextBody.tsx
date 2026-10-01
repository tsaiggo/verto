import { Fragment } from "react";
import { mailTextParts } from "@/lib/mail/text-links";
import content from "./MailContent.module.css";

export default function MailTextBody({ text }: { text: string }) {
  return mailTextParts(text).map((part, index) =>
    part.href ? (
      <a
        key={index}
        className={content.bodyLink}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
      >
        {part.text}
      </a>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    )
  );
}
