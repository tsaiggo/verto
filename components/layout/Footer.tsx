import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="border-t border-border text-text-muted transition-[background-color,color,border-color] duration-[150ms] ease-in-out"
      style={{ padding: "24px 20px", fontSize: 13 }}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <div>
          <span className="font-semibold text-text">Verto</span>
          {" · Read. Note. Remember."}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <a
            href="https://github.com/tsaiggo/verto"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted no-underline transition-colors duration-[150ms] ease-in-out hover:text-text"
          >
            GitHub
          </a>
          <span className="text-text-light">&middot;</span>
          <Link
            href="/help"
            className="text-text-muted no-underline transition-colors duration-[150ms] ease-in-out hover:text-text"
          >
            Help
          </Link>
          <span className="text-text-light">&middot;</span>
          <Link
            href="/blog"
            className="text-text-muted no-underline transition-colors duration-[150ms] ease-in-out hover:text-text"
          >
            Blog
          </Link>
        </div>
        <div className="text-text-light" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} Verto
        </div>
      </div>
    </footer>
  );
}
