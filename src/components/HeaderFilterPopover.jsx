import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  openPanelMotionClass,
  useOpenTransition,
} from "../hooks/useOpenTransition.js";

const DEFAULT_WIDTH = 320;

const panelClass =
  "bg-base-100 rounded-box shadow-lg border border-base-300 overflow-hidden flex flex-col max-w-[calc(100vw-16px)] origin-top";

export function HeaderFilterPopover({
  open,
  onOpenChange,
  title,
  label,
  showTitle = false,
  width = DEFAULT_WIDTH,
  onWillOpen,
  children,
  triggerClassName = "inline-flex items-center justify-center gap-0.5",
}) {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const { mounted, shown } = useOpenTransition(open);
  const [pos, setPos] = useState({ top: 0, left: 0, width });

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelWidth = Math.min(window.innerWidth - 16, width);
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - panelWidth / 2),
      window.innerWidth - panelWidth - 8,
    );
    setPos({ top: r.bottom + 8, left, width: panelWidth });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onWin = () => updatePos();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      onOpenChange(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            onOpenChange(false);
            return;
          }
          onWillOpen?.();
          onOpenChange(true);
        }}
      >
        {label ?? title}
        <ChevronDown
          className={`size-3.5 shrink-0 opacity-60 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.75}
        />
      </button>
      {mounted
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={title}
              className={`${panelClass} ${openPanelMotionClass(shown)}`}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 80,
                maxWidth: "calc(100vw - 16px)",
              }}
            >
              <div className="p-3 max-h-[min(32rem,85vh)] overflow-x-hidden overflow-y-auto overscroll-contain">
                {showTitle ? (
                  <p className="text-sm font-medium mb-2">{title}</p>
                ) : null}
                {children}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
