import type React from 'react';

/**
 * TaskList — overrides `<ul>` when it contains GFM task list items.
 * Uses `.task-list` CSS class from globals.css for styling.
 */
export default function TaskList(
  props: React.ComponentPropsWithoutRef<'ul'>,
) {
  return <ul {...props} className="task-list" />;
}
