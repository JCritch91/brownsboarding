"use client";

import { useEffect } from "react";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  confirmText: string;
  cancelText?: string;
  isConfirming?: boolean;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationModal({
  isOpen,
  title,
  children,
  confirmText,
  cancelText = "Cancel",
  isConfirming = false,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isConfirming) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, isConfirming, onCancel]);

  if (!isOpen) {
    return null;
  }

  const confirmButtonStyles = {
    danger:
      "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700",
    warning:
      "border-amber-600 bg-amber-600 text-white hover:border-amber-700 hover:bg-amber-700",
    primary:
      "border-[#5C4033] bg-[#5C4033] text-white hover:border-[#4A3329] hover:bg-[#4A3329]",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="w-full max-w-lg rounded-2xl border border-[#D9CBB8] bg-white p-5 shadow-2xl md:p-7"
      >
        <h2
          id="confirmation-modal-title"
          className="text-xl font-semibold text-[#5C4033] md:text-2xl"
        >
          {title}
        </h2>

        <div className="mt-4 text-sm leading-6 text-[#6F5545] md:text-base">
          {children}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#D9CBB8] bg-white px-4 py-2 text-sm font-semibold text-[#5C4033] transition-colors hover:border-[#8B6A4E] hover:bg-[#FFFDF9] disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:text-base ${confirmButtonStyles[variant]}`}
          >
            {isConfirming ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
