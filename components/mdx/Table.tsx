import type React from "react";

/**
 * Table — wraps `<table>` in a horizontally scrollable container for mobile.
 * Table styling (.prose table) is handled by globals.css.
 */
export default function Table(props: React.ComponentPropsWithoutRef<"table">) {
  return (
    <div style={{ overflowX: "auto", margin: "24px 0" }}>
      <table {...props} />
    </div>
  );
}
