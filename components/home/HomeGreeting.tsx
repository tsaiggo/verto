export default function HomeGreeting({
  subtitle = "Here’s what’s happening in your local workspace.",
}: {
  subtitle?: string;
}) {
  return (
    <>
      <h1 className="pgh-title">Reading workspace</h1>
      <p className="pgh-subtitle">{subtitle}</p>
    </>
  );
}
