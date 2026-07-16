import Link from "next/link";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPanel } from "@/components/ui/content-primitives";
import type { StudioCard } from "@/lib/studio-cards";
import styles from "./StudioCards.module.css";

interface StudioCardTileProps {
  card: StudioCard;
  onOpen: (card: StudioCard) => void;
  onCopy: (card: StudioCard) => void;
  onEdit: (card: StudioCard) => void;
  onDelete: (card: StudioCard) => void;
}

export default function StudioCardTile({
  card,
  onOpen,
  onCopy,
  onEdit,
  onDelete,
}: StudioCardTileProps) {
  return (
    <ContentPanel variant="outlined" className={styles.tile}>
      <button
        type="button"
        className={styles.tileMain}
        onClick={() => onOpen(card)}
        aria-label={`View ${card.title} details`}
      >
        <span className={styles.kind}>{card.kind}</span>
        <span className={styles.title}>{card.title}</span>
        <span className={styles.description}>{card.desc}</span>
      </button>
      <div className={styles.tileFooter}>
        <Button asChild variant="ghost" size="sm" className={styles.sourceLink}>
          <Link href={card.href}>
            <ExternalLink aria-hidden /> Open source
          </Link>
        </Button>
        <div className={styles.tileActions}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.iconAction}
            onClick={() => onCopy(card)}
            aria-label={`Copy ${card.title}`}
            title="Copy card"
          >
            <Copy aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.iconAction}
            onClick={() => onEdit(card)}
            aria-label={`Edit ${card.title}`}
            title="Edit card"
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`${styles.iconAction} ${styles.deleteAction}`}
            onClick={() => onDelete(card)}
            aria-label={`Delete ${card.title}`}
            title="Delete card"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </ContentPanel>
  );
}
