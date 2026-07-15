"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type Coords =
  | { top: number; bottom?: undefined; left: number; right: number }
  | { bottom: number; top?: undefined; left: number; right: number };

const MENU_MARGIN = 8;

/**
 * A "⋯" trigger whose menu renders in a portal on `document.body`, positioned
 * via the trigger's bounding rect. This keeps it from being clipped by
 * ancestor `overflow-hidden`/`overflow-x-auto` containers (e.g. table
 * wrappers), which a plain absolutely-positioned child can't escape.
 */
export default function ActionMenu({ label = "More actions", align = "right", onOpen, children }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  /**
   * Anchors below the trigger by default, but flips above it when there
   * isn't enough room below (and there's more room above) — otherwise a
   * trigger near the bottom of the page renders a menu that runs off-screen.
   * Uses the menu's already-rendered height when available (menuRef), so the
   * flip decision is accurate rather than a fixed-height guess.
   */
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + MENU_MARGIN && spaceAbove > spaceBelow;

    setCoords({
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      left: rect.left,
      right: window.innerWidth - rect.right,
    } as Coords);
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

  // Re-measure once the menu has actually mounted — the first updatePosition
  // (above, in handleTriggerClick) ran before it existed, so it couldn't
  // know the real height to flip against. useLayoutEffect keeps this
  // correction invisible to the user (applied before the browser paints).
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

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
              ...(coords.top !== undefined ? { top: coords.top } : { bottom: coords.bottom }),
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
