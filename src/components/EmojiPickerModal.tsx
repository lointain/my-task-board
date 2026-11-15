import { useMemo, useState } from "react";
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
      title="选择图标"
      subtitle={value ? `当前：${value}` : "每个节点都能单独设置；不设就继承父级"}
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
            className="mr-auto h-8 rounded-lg px-2.5 text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            清除图标
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[11px] text-slate-300 hover:bg-white/5"
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
            placeholder="也可以直接粘贴一个 emoji 后回车"
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 text-[12px] text-slate-200 outline-none focus:border-emerald-400/40"
          />
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={() => {
              onPick(draft.trim());
              setDraft("");
              setQuery("");
            }}
            className="h-8 rounded-lg bg-emerald-400 px-3 text-[11px] font-medium text-emerald-950 disabled:opacity-40"
          >
            使用
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选分类（常用 / 工作 / 生活 / 符号）"
          className="h-7 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] text-slate-300 outline-none"
        />

        <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
          {filtered.map((group) => (
            <div key={group.name}>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                {group.name}
              </div>
              <div className="grid grid-cols-12 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={`${group.name}-${emoji}`}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setQuery("");
                      setDraft("");
                    }}
                    className={[
                      "flex h-8 items-center justify-center rounded-md text-lg hover:bg-white/10",
                      emoji === value ? "bg-emerald-400/15 ring-1 ring-emerald-400/50" : "",
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
