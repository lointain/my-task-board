import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

const COLORS = ["#34d399", "#60a5fa", "#f87171", "#fbbf24", "#c084fc", "#fb923c", "#94a3b8"];

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectModal({ open, onClose }: ProjectModalProps) {
  const createProject = useAppStore((state) => state.createProject);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setColor(COLORS[0]);
      setEmoji("");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      title={t("新建项目")}
      subtitle={t("顶层节点就是项目，也是根任务")}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (!title.trim()) return;
              void createProject(title, color, emoji.trim() || undefined);
              onClose();
            }}
            className="h-8 rounded-lg bg-accent-400 px-3 text-[11px] font-medium text-accent-950 hover:bg-accent-300"
          >
            创建
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] text-[var(--t3)]">{t("项目名称")}</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) {
                void createProject(title, color, emoji.trim() || undefined);
                onClose();
              }
            }}
            placeholder={t("例如：TaskBoard 开发")}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--t1)] outline-none focus:border-accent-400/40"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] text-[var(--t3)]">{t("图标（可选）")}</span>
          <input
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            placeholder={t("🚀 或任意 emoji")}
            maxLength={4}
            className="h-9 w-24 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 text-center text-sm text-[var(--t1)] outline-none focus:border-accent-400/40"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-[11px] text-[var(--t3)]">{t("颜色")}</span>
          <div className="flex gap-2">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                className={[
                  "h-7 w-7 rounded-full border-2",
                  color === item ? "border-white" : "border-transparent",
                ].join(" ")}
                style={{ backgroundColor: item }}
                aria-label={item}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
