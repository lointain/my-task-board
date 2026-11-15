import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => {
      window.removeEventListener("click", handler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[60] min-w-[168px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1 shadow-2xl"
      style={{
        left: Math.min(x, window.innerWidth - 190),
        top: Math.min(y, window.innerHeight - 220),
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={[
              "flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-[var(--hover-strong)]",
              item.danger ? "text-red-300" : "text-[var(--t2)]",
            ].join(" ")}
          >
            {Icon ? <Icon size={13} /> : <span className="w-[13px]" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
