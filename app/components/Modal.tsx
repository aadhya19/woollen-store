"use client";

import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  /** e.g. z-[60] so this modal stacks above another z-50 modal */
  backdropClassName?: string;
};

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  panelClassName,
  backdropClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-[#245236]/35 p-4 backdrop-blur-sm ${backdropClassName ?? "z-50"}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl rounded-2xl border border-[#245236]/20 bg-white shadow-2xl ${panelClassName ?? ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#245236]/20 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#245236]">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-[#245236]/75">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#245236]/30 bg-[#FEED01]/35 px-3 py-1.5 text-sm font-medium text-[#245236] hover:bg-[#FEED01]/55"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
