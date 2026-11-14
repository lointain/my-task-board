import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = "max-w-2xl",
  footer,
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-200"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line-soft)] px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
