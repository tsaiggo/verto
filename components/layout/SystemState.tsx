import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import styles from "./SystemState.module.css";

export function SystemState({
  actions,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  actions: ReactNode;
  description: ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className={styles.state} aria-labelledby="system-state-title">
      <span className={styles.mark} aria-hidden>
        <Icon />
      </span>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title} id="system-state-title">
        {title}
      </h1>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}

export { styles as systemStateStyles };
