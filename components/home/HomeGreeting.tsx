export default function HomeGreeting({
  title = "Local workspace",
  subtitle = "Here’s what’s happening in your local workspace.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <>
      <h1 className="pgh-title">{title}</h1>
      <p className="pgh-subtitle">{subtitle}</p>
    </>
  );
}
