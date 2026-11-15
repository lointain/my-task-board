import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { t } from "../lib/i18n";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
  /** 点击遮罩是否关闭；拆解这类高频键盘界面应设为 false。 */
  dismissOnBackdrop?: boolean;
  /** 是否响应 Esc 关闭。 */
  closeOnEscape?: boolean;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = "max-w-2xl",
  footer,
  dismissOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const guardRef = useRef(0);

  useEffect(() => {
    guardRef.current = Date.now();
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        // 打开后的同一次点击手势不要立刻把弹窗关掉
        if (!dismissOnBackdrop) return;
        if (Date.now() - guardRef.current < 250) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--t1)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] text-[var(--t3)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--t3)] hover:bg-[var(--hover)] hover:text-[var(--t1)]"
            aria-label={t("关闭")}
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
