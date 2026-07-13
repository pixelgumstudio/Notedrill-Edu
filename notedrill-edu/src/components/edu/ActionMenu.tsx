"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ActionMenuProps {
  /** aria-label / title for the trigger button. */
  label?: string;
  /** Which edge of the trigger the menu's own edge should line up with. */
  align?: "left" | "right";
  /** Called right before the menu opens — use to set which row/item is "active". */
  onOpen?: () => void;
  /** Render prop so menu items can call `close()` after acting. */
  children: (close: () => void) => React.ReactNode;
}

/**
 * A "⋯" trigger whose menu renders in a portal on `document.body`, positioned
 * via the trigger's bounding rect. This keeps it from being clipped by
 * ancestor `overflow-hidden`/`overflow-x-auto` containers (e.g. table
 * wrappers), which a plain absolutely-positioned child can't escape.
 */
export default function ActionMenu({ label = "More actions", align = "right", onOpen, children }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        onOpen?.();
        updatePosition();
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-edu-line bg-white text-sm text-edu-blue-grey hover:bg-edu-paper-2"
        onClick={handleTriggerClick}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[1500] min-w-[220px] overflow-hidden rounded-lg border border-edu-line bg-white"
            style={{
              top: coords.top,
              ...(align === "right" ? { right: coords.right } : { left: coords.left }),
              boxShadow: "0 6px 20px rgba(21,35,31,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
}
