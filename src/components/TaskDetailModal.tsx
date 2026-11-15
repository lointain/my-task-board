import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Check,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Italic,
  List,
  ListTodo,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { repo } from "../data/repository";
import type { TagGroup, Task, TaskStatus } from "../data/types";
import { statusLabel, useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

const EMOJI_CHOICES = [
  "🚀",
  "🎯",
  "🧪",
  "🛠️",
  "📦",
  "📝",
  "🏠",
  "💡",
  "🔥",
  "🌱",
  "🧭",
  "🗂️",
  "📚",
  "💼",
  "🎨",
  "🔬",
  "☕",
  "🏃",
];

function parseNote(noteJson: string | null) {
  if (!noteJson) return "";
  try {
    return JSON.parse(noteJson);
  } catch {
    return "";
  }
}

function EditorButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={[
        "flex h-6 w-6 items-center justify-center rounded-md",
        active
          ? "bg-emerald-400/10 text-emerald-300"
          : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TagPicker({
  groups,
  tags,
  selected,
  onChange,
}: {
  groups: TagGroup[];
  tags: Array<{ id: string; groupId: string; name: string; color: string | null }>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (group: TagGroup, tagId: string) => {
    if (group.mode === "single") {
      const groupTagIds = tags.filter((tag) => tag.groupId === group.id).map((tag) => tag.id);
      onChange([...selected.filter((id) => !groupTagIds.includes(id)), tagId]);
      return;
    }
    onChange(
      selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId],
    );
  };

  if (groups.length === 0) {
    return <p className="text-[11px] text-slate-500">还没有标签组，去设置里添加。</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupTags = tags.filter((tag) => tag.groupId === group.id);
        return (
          <div key={group.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                {group.name}
              </span>
              <span className="text-[9px] text-slate-600">
                {group.mode === "single" ? "单选" : "多选"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groupTags.map((tag) => {
                const active = selected.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(group, tag.id)}
                    className={[
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                      active
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-[var(--line)] text-slate-400 hover:border-slate-500/50 hover:text-slate-200",
                    ].join(" ")}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                    />
                    {tag.name}
                    {active ? <Check size={10} /> : null}
                  </button>
                );
              })}
              {groupTags.length === 0 ? (
                <span className="text-[10px] text-slate-600">暂无标签</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const data = useAppStore((state) => state.data);
  const taskTags = useAppStore((state) => state.taskTags);
  const reload = useAppStore((state) => state.reload);
  const completeTask = useAppStore((state) => state.completeTask);
  const deleteTask = useAppStore((state) => state.deleteTask);

  const [title, setTitle] = useState(task?.title ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueAt, setDueAt] = useState(task?.dueAt ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [emoji, setEmoji] = useState<string>(task?.emoji ?? "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiDraft, setEmojiDraft] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setDueAt(task.dueAt ?? "");
    setEmoji(task.emoji ?? "");
    setSelectedTags(taskTags[task.id] ?? []);
  }, [task, taskTags]);

  const applyEmoji = async (value: string) => {
    if (!task) return;
    setEmoji(value);
    setEmojiOpen(false);
    setEmojiDraft("");
    await repo.taskUpdate(task.id, { emoji: value });
    await reload();
  };

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        // TaskList 放在 StarterKit 之前，让 "- [ ] " 的输入规则先于 bulletList 生效
        TaskList,
        TaskItem.configure({ nested: true }),
        StarterKit.configure({ link: { openOnClick: false } }),
        Image,
        Placeholder.configure({
          placeholder: "记录上下文、下一步、链接… 输入 `[] ` 创建待办",
        }),
      ],
      content: parseNote(task?.noteJson ?? null),
      editorProps: { attributes: { class: "tiptap" } },
    },
    [task?.id],
  );

  if (!task) return null;

  const tagSummary = (() => {
    if (selectedTags.length === 0) return "未设置属性";
    const names = selectedTags
      .map((id) => data?.tags.find((tag) => tag.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(" · ") : "未设置属性";
  })();

  const save = async () => {
    setSaving(true);
    try {
      // 说明是否存在由内容决定：空的编辑器不落库
      const empty = !editor || editor.isEmpty;
      const json = empty ? "" : JSON.stringify(editor.getJSON());
      const text = empty ? "" : editor.getText();
      await repo.taskUpdate(task.id, {
        title: title.trim() || task.title,
        status,
        dueAt,
        noteJson: json,
        noteText: text,
      });
      await repo.taskSetTags(task.id, selectedTags);
      await reload();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(task)}
      title="任务详情"
      subtitle={
        task.dueSource && task.dueSource !== "own" ? `截止日继承自「${task.dueSource}」` : undefined
      }
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm("删除这个任务及其所有子任务？")) {
                await deleteTask(task.id);
                onClose();
              }
            }}
            className="mr-auto flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] text-red-300 hover:bg-red-400/10"
          >
            <Trash2 size={13} /> 删除
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[11px] text-slate-300 hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-8 rounded-lg bg-emerald-400 px-3 text-[11px] font-medium text-emerald-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              const done = status !== "done";
              setStatus(done ? "done" : "todo");
              void completeTask(task.id, done);
            }}
            className={[
              "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
              status === "done"
                ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                : "border-slate-600 text-transparent hover:border-emerald-400",
            ].join(" ")}
            title="完成 / 取消完成"
          >
            <Check size={12} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmojiOpen((open) => !open)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--line)] text-base hover:border-emerald-400/40"
                title="设置图标"
                aria-label="设置图标"
              >
                {emoji || "＋"}
              </button>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight text-slate-100 outline-none"
              />
            </div>
            {emojiOpen ? (
              <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2">
                {EMOJI_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => void applyEmoji(choice)}
                    className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
                  >
                    {choice}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void applyEmoji("")}
                  className="ml-1 h-7 rounded px-2 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  清除
                </button>
                <input
                  value={emojiDraft}
                  onChange={(event) => setEmojiDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && emojiDraft.trim())
                      void applyEmoji(emojiDraft.trim());
                  }}
                  placeholder="粘贴任意 emoji"
                  className="h-7 w-28 rounded border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-slate-200 outline-none"
                />
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 text-[11px] text-slate-300 outline-none"
              >
                {(["todo", "doing", "done", "archived"] as TaskStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
              <label className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--line)] px-2 text-[11px] text-slate-400">
                截止
                <input
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="bg-transparent text-slate-300 outline-none"
                />
              </label>
              {task.dueSource ? (
                <span className="text-[10px] text-slate-500">
                  {task.dueSource === "own" ? "自己的截止日" : `继承自「${task.dueSource}」`}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]">
          <button
            type="button"
            onClick={() => setPropsOpen((open) => !open)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            {propsOpen ? (
              <ChevronDown size={13} className="text-slate-500" />
            ) : (
              <ChevronRight size={13} className="text-slate-500" />
            )}
            <span className="text-xs font-medium text-slate-300">属性</span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{tagSummary}</span>
            <span className="shrink-0 text-[9px] text-slate-600">标签组</span>
          </button>
          {propsOpen ? (
            <div className="border-t border-[var(--line-soft)] px-3.5 pb-3 pt-2.5">
              <TagPicker
                groups={data?.tagGroups ?? []}
                tags={data?.tags ?? []}
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2">
            <h3 className="text-xs font-medium text-slate-300">说明</h3>
            <span className="text-[9px] text-slate-600">可留空</span>
          </div>
          <div className="flex items-center gap-0.5 border-b border-[var(--line-soft)] px-2 py-1">
            <EditorButton
              label="粗体"
              active={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={13} />
            </EditorButton>
            <EditorButton
              label="斜体"
              active={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={13} />
            </EditorButton>
            <EditorButton
              label="无序列表"
              active={editor?.isActive("bulletList")}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={13} />
            </EditorButton>
            <EditorButton
              label="待办列表"
              active={editor?.isActive("taskList")}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListTodo size={13} />
            </EditorButton>
            <EditorButton
              label="插入图片 URL"
              onClick={() => {
                const src = window.prompt("图片 URL");
                if (src?.trim()) {
                  editor?.chain().focus().setImage({ src: src.trim() }).run();
                }
              }}
            >
              <ImageIcon size={13} />
            </EditorButton>
            <span className="ml-auto text-[9px] text-slate-600">`[]` 生成待办</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto px-3.5 py-3">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
