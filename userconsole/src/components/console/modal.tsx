"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";

type ModalProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  size?: "sm" | "md" | "lg";
  title: string;
};

const modalWidths = {
  sm: "max-w-[430px]",
  md: "max-w-[620px]",
  lg: "max-w-[820px]",
};

export function Modal({
  children,
  description,
  onClose,
  open,
  size = "md",
  title,
}: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-[#26324b]/25 backdrop-blur-md"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="console-modal-title"
        className={`console-glass-header relative max-h-[90vh] w-full overflow-hidden rounded-[26px] ${modalWidths[size]}`}
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/65 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="console-modal-title"
              className="text-lg font-semibold tracking-[-.025em] text-[#25252a]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-[#77777e]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="关闭"
            className="glass-control flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#65656c] hover:bg-white/75"
            onClick={onClose}
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[calc(90vh-76px)] overflow-y-auto">
          {children}
        </div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  description,
  confirmLabel = "确认删除",
  onCancel,
  onConfirm,
  open,
  title,
}: {
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="p-5 sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-white/75 bg-[#fff0ed]/80 text-[#dc5947] shadow-[inset_0_1px_0_white]">
          <Icon name="trash" className="h-5 w-5" />
        </div>
        <p className="mt-5 text-sm leading-7 text-[#66666d]">{description}</p>
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold text-[#55555c]"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="h-10 rounded-[13px] bg-[#e65d4f] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(212,73,62,.2)]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <output className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/80 bg-[#25252a]/88 px-4 py-2.5 text-xs font-medium text-white shadow-[0_16px_38px_rgba(30,35,50,.24)] backdrop-blur-xl">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#35c28b]">
        <Icon name="check" className="h-3 w-3" />
      </span>
      {message}
    </output>
  );
}
