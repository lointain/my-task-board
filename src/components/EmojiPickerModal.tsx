import { useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { Modal } from "./Modal";

const GROUPS: Array<{ name: string; emojis: string[] }> = [
  {
    name: "常用",
    emojis: "🚀 🎯 🧪 🛠️ 📦 📝 💡 🔥 🌱 🧭 🗂️ 📚 💼 🎨 🔬 ☕ 🏃 ✅ ⏳ 🧩 ⚙️ 🧠 💬 📌".split(" "),
  },
  {
    name: "工作",
    emojis: "📊 📈 📉 🗓️ 📅 🖥️ 💻 ⌨️ 🖱️ 📱 🔌 🧾 🧮 🏷️ 📎 🖇️ 📋 🗒️ 🗃️ 🗄️ 📁 📂 🔖 ✍️".split(" "),
  },
  {
    name: "生活",
    emojis: "🏠 🛏️ 🍳 🥗 ☕ 🍵 🍺 🎮 🎧 🎬 📷 🎸 🚲 🏃 🧘 🛒 🧺 🐱 🐶 🌿 🌸 ☀️ 🌙 ⛅".split(" "),
  },
  {
    name: "符号",
    emojis: "⭐ 🌟 ✨ ⚡ 💫 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔺 🔻 🔶 🔷 ❗ ❓ ❌ ✔️ ➕ ➖ ♻️ 🆕".split(" "),
  },
];

interface EmojiPickerModalProps {
  open: boolean;
  value: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerModal({ open, value, onPick, onClose }: EmojiPickerModalProps) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      GROUPS.map((group) => ({
        name: group.name,
        emojis: group.emojis.filter(() => !query || group.name.includes(query)),
      })).filter((group) => group.emojis.length > 0),
    [query],
  );

  return (
    <Modal
      open={open}
      title={t("选择图标")}
      subtitle={
        value ? t("当前：{emoji}", { emoji: value }) : t("每个节点都能单独设置；不设就继承父级")
      }
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              onPick("");
              setDraft("");
              setQuery("");
            }}
            className="mr-auto h-8 rounded-lg px-2.5 text-[11px] text-[var(--t3)] hover:bg-[var(--hover)] hover:text-[var(--t1)]"
          >
            {t("清除图标")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
          >
            关闭
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && draft.trim()) {
                onPick(draft.trim());
                setDraft("");
                setQuery("");
              }
            }}
            placeholder={t("也可以直接粘贴一个 emoji 后回车")}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 text-[12px] text-[var(--t1)] outline-none focus:border-accent-400/40"
          />
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={() => {
              onPick(draft.trim());
              setDraft("");
              setQuery("");
            }}
            className="h-8 rounded-lg bg-accent-400 px-3 text-[11px] font-medium text-accent-950 disabled:opacity-40"
          >
            使用
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("筛选分类（常用 / 工作 / 生活 / 符号）")}
          className="h-7 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] text-[var(--t2)] outline-none"
        />

        <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
          {filtered.map((group) => (
            <div key={t(group.name)}>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
                {t(group.name)}
              </div>
              <div className="grid grid-cols-12 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={`${t(group.name)}-${emoji}`}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setQuery("");
                      setDraft("");
                    }}
                    className={[
                      "flex h-8 items-center justify-center rounded-md text-lg hover:bg-[var(--hover-strong)]",
                      emoji === value ? "bg-accent-400/15 ring-1 ring-accent-400/50" : "",
                    ].join(" ")}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
