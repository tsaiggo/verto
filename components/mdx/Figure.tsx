/**
 * Figure — `<figure>` with responsive `<img>` and optional `<figcaption>`.
 * Uses `.img-caption` class from globals.css for caption styling.
 */
export default function Figure({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure style={{ margin: '28px 0' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 'var(--radius-lg)',
          display: 'block',
        }}
      />
      {caption && <figcaption className="img-caption">{caption}</figcaption>}
    </figure>
  );
}
