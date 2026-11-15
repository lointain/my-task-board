import { Database, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { repo } from "../data/repository";
import type { TagGroup } from "../data/types";
import { groupColor } from "../lib/board";
import { useAppStore } from "../store/useAppStore";
import { Modal } from "./Modal";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const data = useAppStore((state) => state.data);
  const saveTagGroup = useAppStore((state) => state.saveTagGroup);
  const deleteTagGroup = useAppStore((state) => state.deleteTagGroup);
  const saveTag = useAppStore((state) => state.saveTag);
  const deleteTag = useAppStore((state) => state.deleteTag);
  const setSetting = useAppStore((state) => state.setSetting);
  const backup = useAppStore((state) => state.backup);

  const [groupName, setGroupName] = useState("");
  const [groupMode, setGroupMode] = useState<"single" | "multi">("single");
  const [groupFree, setGroupFree] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [momentum, setMomentum] = useState("0.25");
  const [colorBy, setColorBy] = useState("project");
  const [showMomentum, setShowMomentum] = useState(true);
  const [horizon, setHorizon] = useState("7");
  const [childMode, setChildMode] = useState("direct");
  const [dataDir, setDataDir] = useState("");
  const [backupPath, setBackupPath] = useState("");

  useEffect(() => {
    if (!open) return;
    setMomentum(data?.settings.momentum_default ?? "0.25");
    setColorBy(data?.settings.color_by ?? "project");
    setShowMomentum(data?.settings.show_momentum !== "false");
    setHorizon(data?.settings.momentum_horizon_days ?? "7");
    setChildMode(data?.settings.child_view_mode ?? "direct");
    void repo
      .dataDir()
      .then(setDataDir)
      .catch(() => setDataDir(""));
  }, [open, data?.settings]);

  if (!open) return null;

  const addTag = async (group: TagGroup) => {
    const name = (tagDrafts[group.id] ?? "").trim();
    if (!name) return;
    await saveTag({ groupId: group.id, name, color: groupColor(group) });
    setTagDrafts((prev) => ({ ...prev, [group.id]: "" }));
  };

  return (
    <Modal
      open={open}
      title="设置"
      subtitle="标签组、动量默认、颜色、备份"
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-[var(--t1)]">标签组</h3>
            <span className="text-[10px] text-[var(--t4)]">单选 / 多选 / 自由输入</span>
          </div>

          <div className="space-y-2">
            {(data?.tagGroups ?? []).map((group) => {
              const tags = (data?.tags ?? []).filter((tag) => tag.groupId === group.id);
              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: groupColor(group) }}
                    />
                    <span className="text-[12px] font-medium text-[var(--t1)]">{group.name}</span>
                    <span className="rounded border border-[var(--line)] px-1 text-[9px] text-[var(--t3)]">
                      {group.mode === "single" ? "单选" : "多选"}
                    </span>
                    {group.isFree ? (
                      <span className="rounded border border-emerald-400/20 px-1 text-[9px] text-emerald-300">
                        自由
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`删除标签组「${group.name}」及其标签？`)) {
                          void deleteTagGroup(group.id);
                        }
                      }}
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded text-red-300/70 hover:bg-red-400/10 hover:text-red-300"
                      title="删除标签组"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--t2)]"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                        />
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => void deleteTag(tag.id)}
                          className="text-[var(--t4)] hover:text-red-300"
                          title="删除标签"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {tags.length === 0 ? (
                      <span className="text-[10px] text-[var(--t4)]">暂无标签</span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex gap-1.5">
                    <input
                      value={tagDrafts[group.id] ?? ""}
                      onChange={(event) =>
                        setTagDrafts((prev) => ({ ...prev, [group.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void addTag(group);
                      }}
                      placeholder="新增标签…"
                      className="h-7 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[10px] text-[var(--t1)] outline-none focus:border-emerald-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => void addTag(group)}
                      className="flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-[10px] text-[var(--t2)] hover:bg-[var(--hover)]"
                    >
                      <Plus size={11} /> 添加
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="新标签组名称"
                className="h-8 min-w-[160px] flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t1)] outline-none focus:border-emerald-400/40"
              />
              <select
                value={groupMode}
                onChange={(event) => setGroupMode(event.target.value as "single" | "multi")}
                className="h-8 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)]"
              >
                <option value="single">单选</option>
                <option value="multi">多选</option>
              </select>
              <label className="flex items-center gap-1 text-[10px] text-[var(--t3)]">
                <input
                  type="checkbox"
                  checked={groupFree}
                  onChange={(event) => setGroupFree(event.target.checked)}
                />
                自由输入
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!groupName.trim()) return;
                  void saveTagGroup({
                    name: groupName.trim(),
                    mode: groupMode,
                    isFree: groupFree,
                  });
                  setGroupName("");
                  setGroupFree(false);
                }}
                className="h-8 rounded-md bg-emerald-400 px-3 text-[11px] font-medium text-emerald-950 hover:bg-emerald-300"
              >
                新建组
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
            <h3 className="text-xs font-medium text-[var(--t1)]">默认动量</h3>
            <p className="mt-1 text-[10px] text-[var(--t3)]">
              无截止日任务的默认 x 速度（点/天）。
            </p>
            <div className="mt-2 flex gap-1.5">
              <input
                value={momentum}
                onChange={(event) => setMomentum(event.target.value)}
                className="h-8 w-24 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t1)] outline-none"
              />
              <button
                type="button"
                onClick={() => void setSetting("momentum_default", momentum)}
                className="h-8 rounded-md border border-[var(--line)] px-2 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
              >
                保存
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
            <h3 className="text-xs font-medium text-[var(--t1)]">图上显示</h3>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--t2)]">
              <input
                type="checkbox"
                checked={showMomentum}
                onChange={(event) => {
                  setShowMomentum(event.target.checked);
                  void setSetting("show_momentum", event.target.checked ? "true" : "false");
                }}
              />
              显示动量（线段、刻度、虚影、逾期尾巴）
            </label>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--t2)]">
              选中面板的子节点
              <select
                value={childMode}
                onChange={(event) => {
                  setChildMode(event.target.value);
                  void setSetting("child_view_mode", event.target.value);
                }}
                className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)]"
              >
                <option value="direct">直接子节点</option>
                <option value="breadcrumb">面包屑 + 列表</option>
                <option value="tree">整棵子树</option>
              </select>
            </label>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--t2)]">
              预测天数
              <select
                value={horizon}
                onChange={(event) => {
                  setHorizon(event.target.value);
                  void setSetting("momentum_horizon_days", event.target.value);
                }}
                className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)]"
              >
                {["3", "7", "14"].map((value) => (
                  <option key={value} value={value}>
                    {value} 天
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
            <h3 className="text-xs font-medium text-[var(--t1)]">着色依据</h3>
            <p className="mt-1 text-[10px] text-[var(--t3)]">点颜色按项目或某个标签组。</p>
            <div className="mt-2 flex gap-1.5">
              <select
                value={colorBy}
                onChange={(event) => {
                  setColorBy(event.target.value);
                  void setSetting("color_by", event.target.value);
                }}
                className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11px] text-[var(--t2)]"
              >
                <option value="project">按项目</option>
                {(data?.tagGroups ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    按标签组：{group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-[var(--t1)]">
            <Database size={13} /> 数据与备份
          </h3>
          <p className="mt-1 break-all text-[10px] text-[var(--t3)]">数据目录：{dataDir || "…"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const path = await backup();
                if (path) setBackupPath(path);
              }}
              className="h-8 rounded-md border border-[var(--line)] px-3 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
            >
              立即备份
            </button>
            {backupPath ? (
              <span className="break-all text-[10px] text-emerald-300">{backupPath}</span>
            ) : null}
          </div>
        </section>
      </div>
    </Modal>
  );
}
