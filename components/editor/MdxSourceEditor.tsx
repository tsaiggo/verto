"use client";

import {
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import {
  applyMdxSlashCommand,
  filterMdxSlashCommands,
  findMdxSlashTrigger,
  hasMdxOnlySlashMatch,
  type MdxSlashCommand,
  type MdxSlashCommandFormat,
  type MdxSlashTrigger,
} from "./mdx-slash-commands";
import {
  clampEditorMenuPosition,
  measureTextareaCaret,
  scrollTextareaSelectionIntoView,
} from "./mdx-source-editor-caret";
import { MdxSlashCommandMenu } from "./MdxSlashCommandMenu";
import styles from "./MdxSourceEditor.module.css";

type NativeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "defaultValue" | "onChange" | "value"
>;

export interface MdxSourceEditorProps extends NativeTextareaProps {
  format?: MdxSlashCommandFormat;
  textareaClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const MENU_WIDTH = 304;

export const MdxSourceEditor = forwardRef<HTMLTextAreaElement, MdxSourceEditorProps>(
  // eslint-disable-next-line max-lines-per-function -- One controller keeps textarea focus, native undo, menu navigation, IME, and caret placement in one state machine.
  function MdxSourceEditor(
    {
      className,
      format = "mdx",
      onBlur,
      onClick,
      onCompositionEnd,
      onCompositionStart,
      onFocus,
      onKeyDown,
      onKeyUp,
      onPaste,
      onScroll,
      onSelect,
      onValueChange,
      readOnly,
      textareaClassName,
      value,
      ...textareaProps
    },
    forwardedRef
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const composingRef = useRef(false);
    const suppressPastedInputRef = useRef(false);
    const suppressMenuSyncRef = useRef(false);
    const dismissedMenuKeyRef = useRef<string | null>(null);
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const menuId = useId();
    const [trigger, setTrigger] = useState<MdxSlashTrigger | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<MenuPosition>({ left: 8, top: 44 });
    const [announcement, setAnnouncement] = useState("");

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

    const commands = useMemo(
      () => (trigger ? filterMdxSlashCommands(trigger.query, format) : []),
      [format, trigger]
    );
    const resolvedActiveIndex = Math.min(activeIndex, Math.max(0, commands.length - 1));
    const selectedCommand = commands[resolvedActiveIndex] ?? null;
    const selectedOptionId = selectedCommand ? `${menuId}-option-${selectedCommand.id}` : undefined;
    const richBlocksUnavailable =
      Boolean(trigger) &&
      commands.length === 0 &&
      format === "md" &&
      hasMdxOnlySlashMatch(trigger?.query ?? "");

    const updatePosition = useCallback((caret: number) => {
      const textarea = textareaRef.current;
      const root = rootRef.current;
      if (!textarea || !root) return;
      const caretPosition = measureTextareaCaret(textarea, caret);
      const availableWidth = Math.max(0, root.clientWidth);
      const availableHeight = Math.max(0, root.clientHeight);
      const renderedMenuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
      const left = clampEditorMenuPosition(
        caretPosition.left,
        8,
        Math.max(8, availableWidth - MENU_WIDTH - 8)
      );
      const below = caretPosition.top + caretPosition.lineHeight + 6;
      const top =
        renderedMenuHeight > 0 && below + renderedMenuHeight > availableHeight - 8
          ? Math.max(8, caretPosition.top - renderedMenuHeight - 6)
          : below;
      setPosition({ left, top });
    }, []);

    const syncMenu = useCallback(
      (nextValue: string) => {
        const textarea = textareaRef.current;
        if (
          !textarea ||
          readOnly ||
          textarea.disabled ||
          composingRef.current ||
          suppressMenuSyncRef.current ||
          textarea.selectionStart !== textarea.selectionEnd
        ) {
          setTrigger(null);
          return;
        }

        const menuKey = `${nextValue}\u0000${textarea.selectionStart}\u0000${textarea.selectionEnd}`;
        if (dismissedMenuKeyRef.current === menuKey) {
          setTrigger(null);
          return;
        }
        dismissedMenuKeyRef.current = null;
        const nextTrigger = findMdxSlashTrigger(nextValue, textarea.selectionStart);
        setTrigger(nextTrigger);
        setActiveIndex(0);
        if (nextTrigger) requestAnimationFrame(() => updatePosition(nextTrigger.end));
      },
      [readOnly, updatePosition]
    );

    const insertCommand = useCallback(
      (command: MdxSlashCommand) => {
        const textarea = textareaRef.current;
        if (!textarea || !trigger) return;
        const insertion = applyMdxSlashCommand(value, trigger, command);

        textarea.focus();
        textarea.setSelectionRange(trigger.start, trigger.end);
        pendingSelectionRef.current = {
          start: insertion.selectionStart,
          end: insertion.selectionEnd,
        };
        suppressMenuSyncRef.current = true;
        if (typeof document.execCommand === "function") {
          document.execCommand("insertText", false, insertion.replacement);
        }
        onValueChange(insertion.source);

        setTrigger(null);
        setAnnouncement(`Inserted ${command.label}.`);
        queueMicrotask(() => {
          suppressMenuSyncRef.current = false;
        });
      },
      [onValueChange, trigger, value]
    );

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || composingRef.current) {
        onKeyDown?.(event);
        return;
      }

      if (trigger) {
        if (event.key === "ArrowDown" && commands.length > 0) {
          event.preventDefault();
          setActiveIndex((current) => Math.min(commands.length - 1, current + 1));
          return;
        }
        if (event.key === "ArrowUp" && commands.length > 0) {
          event.preventDefault();
          setActiveIndex((current) => Math.max(0, current - 1));
          return;
        }
        if (
          (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) &&
          selectedCommand
        ) {
          event.preventDefault();
          insertCommand(selectedCommand);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          const textarea = event.currentTarget;
          dismissedMenuKeyRef.current = `${value}\u0000${textarea.selectionStart}\u0000${textarea.selectionEnd}`;
          setTrigger(null);
          setAnnouncement("Block menu closed.");
          return;
        }
      }

      onKeyDown?.(event);
    };

    useLayoutEffect(() => {
      const selection = pendingSelectionRef.current;
      const textarea = textareaRef.current;
      if (!selection || !textarea) return;
      pendingSelectionRef.current = null;
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
      scrollTextareaSelectionIntoView(textarea);
    }, [value]);

    useLayoutEffect(() => {
      if (!trigger) return;

      updatePosition(trigger.end);
      const menu = menuRef.current;
      const root = rootRef.current;
      if (!menu || typeof ResizeObserver !== "function") return;

      const observer = new ResizeObserver(() => updatePosition(trigger.end));
      observer.observe(menu);
      if (root) observer.observe(root);
      return () => observer.disconnect();
    }, [commands.length, trigger, updatePosition]);

    useEffect(() => {
      if (!trigger || !selectedOptionId) return;
      const option = document.getElementById(selectedOptionId);
      if (
        option &&
        menuRef.current?.contains(option) &&
        typeof option.scrollIntoView === "function"
      ) {
        option.scrollIntoView({ block: "nearest" });
      }
    }, [selectedOptionId, trigger]);

    useEffect(() => {
      if (!trigger) return;
      const closeOutside = (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) setTrigger(null);
      };
      document.addEventListener("pointerdown", closeOutside, true);
      return () => document.removeEventListener("pointerdown", closeOutside, true);
    }, [trigger]);

    return (
      <div ref={rootRef} className={cn(styles.root, className)}>
        <textarea
          {...textareaProps}
          ref={textareaRef}
          className={textareaClassName}
          value={value}
          readOnly={readOnly}
          role="combobox"
          aria-controls={trigger ? menuId : undefined}
          aria-expanded={Boolean(trigger)}
          aria-haspopup="listbox"
          aria-activedescendant={trigger ? selectedOptionId : undefined}
          aria-autocomplete="list"
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setTrigger(null);
            onBlur?.(event);
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            onValueChange(nextValue);
            if (suppressPastedInputRef.current) {
              suppressPastedInputRef.current = false;
              setTrigger(null);
              return;
            }
            syncMenu(nextValue);
          }}
          onClick={(event) => {
            syncMenu(value);
            onClick?.(event);
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            syncMenu(event.currentTarget.value);
            onCompositionEnd?.(event);
          }}
          onCompositionStart={(event) => {
            composingRef.current = true;
            setTrigger(null);
            onCompositionStart?.(event);
          }}
          onFocus={(event) => {
            onFocus?.(event);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            if (
              !["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(event.key) &&
              !event.nativeEvent.isComposing
            ) {
              syncMenu(event.currentTarget.value);
            }
            onKeyUp?.(event);
          }}
          onPaste={(event) => {
            suppressPastedInputRef.current = true;
            setTrigger(null);
            onPaste?.(event);
          }}
          onScroll={(event) => {
            if (trigger) updatePosition(event.currentTarget.selectionStart);
            onScroll?.(event);
          }}
          onSelect={(event) => {
            syncMenu(event.currentTarget.value);
            onSelect?.(event);
          }}
        />

        {trigger ? (
          <MdxSlashCommandMenu
            ref={menuRef}
            id={menuId}
            activeIndex={resolvedActiveIndex}
            commands={commands}
            emptyMessage={
              richBlocksUnavailable ? "Rich blocks require an .mdx file." : "No matching blocks."
            }
            left={position.left}
            top={position.top}
            onHighlight={setActiveIndex}
            onInsert={insertCommand}
          />
        ) : null}

        <span className="sr-only" aria-live="polite">
          {trigger && selectedCommand
            ? `${commands.length} commands. ${selectedCommand.label} selected.`
            : announcement}
        </span>
      </div>
    );
  }
);
