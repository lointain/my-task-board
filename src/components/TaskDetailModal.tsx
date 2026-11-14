import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Check,
  Image as ImageIcon,
  Italic,
  List,
  ListTodo,
  Plus,
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
  const [noteEnabled, setNoteEnabled] = useState(Boolean(task?.noteJson));
  const [noteJson, setNoteJson] = useState<string | null>(task?.noteJson ?? null);
  const [noteText, setNoteText] = useState<string | null>(task?.noteText ?? null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setDueAt(task.dueAt ?? "");
    setNoteEnabled(Boolean(task.noteJson));
    setNoteJson(task.noteJson);
    setNoteText(task.noteText);
    setSelectedTags(taskTags[task.id] ?? []);
  }, [task, taskTags]);

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
          placeholder: "记录上下文、下一步、链接… 输入 `- [ ]` 创建待办",
        }),
      ],
      content: parseNote(task?.noteJson ?? null),
      editorProps: { attributes: { class: "tiptap" } },
      onUpdate: ({ editor: instance }) => {
        setNoteJson(JSON.stringify(instance.getJSON()));
        setNoteText(instance.getText());
      },
    },
    [task?.id, noteEnabled],
  );

  if (!task) return null;

  const save = async () => {
    setSaving(true);
    try {
      await repo.taskUpdate(task.id, {
        title: title.trim() || task.title,
        status,
        dueAt,
        noteJson: noteEnabled ? (noteJson ?? "") : "",
        noteText: noteEnabled ? (noteText ?? "") : "",
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
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full bg-transparent text-lg font-semibold tracking-tight text-slate-100 outline-none"
            />
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

        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-slate-300">属性</h3>
            <span className="text-[10px] text-slate-600">单选/多选标签组</span>
          </div>
          <TagPicker
            groups={data?.tagGroups ?? []}
            tags={data?.tags ?? []}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-2">
            <h3 className="text-xs font-medium text-slate-300">说明</h3>
            {!noteEnabled ? (
              <button
                type="button"
                onClick={() => setNoteEnabled(true)}
                className="flex items-center gap-1 text-[10px] text-emerald-300 hover:text-emerald-200"
              >
                <Plus size={12} /> 添加说明
              </button>
            ) : null}
          </div>
          {noteEnabled ? (
            <>
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
                <span className="ml-auto text-[9px] text-slate-600">支持 `[]` 快捷生成待办</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto px-3.5 py-3">
                <EditorContent editor={editor} />
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-[11px] text-slate-500">
              这个任务没有说明。说明是可选的。
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
