import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code2, Heading2, Italic, List, ListTodo, Redo2, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";

const CONTENT = `
<h2>目标</h2>
<p>先把选型落成一个能跑起来的骨架：React 负责界面，Rust 负责系统与数据，SQLite 负责持久化。</p>
<h2>本周清单</h2>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>搭建 Tauri 2 + React + Vite 骨架</p></li>
  <li data-type="taskItem" data-checked="true"><p>接通 Rust command 与 SQLite hello</p></li>
  <li data-type="taskItem" data-checked="false"><p>把 D3 图和 TipTap 编辑器挂到界面上</p>
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="true"><p>象限背景与坐标轴</p></li>
      <li data-type="taskItem" data-checked="false"><p>点的 hover / 选中样式</p></li>
    </ul>
  </li>
  <li data-type="taskItem" data-checked="false"><p>下一步：接入真实任务 CRUD 与本地 API</p></li>
</ul>
<blockquote><p>提示：输入 <code>- [ ]</code> 可以直接创建待办项，Tab / Shift+Tab 调整缩进。</p></blockquote>
`;

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-7 w-7 items-center justify-center rounded-md border text-[13px] transition-colors",
        active
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
          : "border-transparent text-[var(--t3)] hover:border-[var(--line)] hover:bg-[var(--hover)] hover:text-[var(--t1)]",
        disabled ? "cursor-not-allowed opacity-30" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function NoteEditor() {
  const [count, setCount] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "记录上下文、下一步、链接… 输入 `- [ ]` 创建待办",
      }),
    ],
    content: CONTENT,
    onCreate: ({ editor: instance }) => setCount(instance.getText().length),
    onUpdate: ({ editor: instance }) => setCount(instance.getText().length),
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
  });

  if (!editor) {
    return <div className="h-[220px] animate-pulse rounded-lg bg-[var(--hover)]" />;
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]">
      <div className="flex items-center gap-1 border-b border-[var(--line-soft)] px-2 py-1.5">
        <ToolButton
          label="粗体 (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolButton>
        <ToolButton
          label="斜体 (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolButton>
        <ToolButton
          label="二级标题"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={14} />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-[var(--line)]" />
        <ToolButton
          label="无序列表"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolButton>
        <ToolButton
          label="待办列表"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodo size={14} />
        </ToolButton>
        <ToolButton
          label="代码块"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 size={14} />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-[var(--line)]" />
        <ToolButton
          label="撤销 (Ctrl+Z)"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={14} />
        </ToolButton>
        <ToolButton
          label="重做 (Ctrl+Shift+Z)"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={14} />
        </ToolButton>
        <span className="ml-auto pr-1 text-[10px] uppercase tracking-wider text-[var(--t3)]">
          Markdown
        </span>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-3.5 py-3">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line-soft)] px-3 py-1.5 text-[10px] text-[var(--t3)]">
        <span>自动保存 · 本地</span>
        <span>{count} 字</span>
      </div>
    </div>
  );
}
