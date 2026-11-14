import { invoke } from "@tauri-apps/api/core";
import type {
  AppData,
  MomentumInput,
  Placement,
  PlacementInput,
  StatsPayload,
  Tag,
  TagGroup,
  Task,
  TaskCreateInput,
  TaskPatchInput,
  TaskStatus,
} from "./types";

export const repo = {
  bootstrap: () => invoke<AppData>("bootstrap"),
  taskCreate: (input: TaskCreateInput) => invoke<Task>("task_create", { input }),
  taskUpdate: (id: string, patch: TaskPatchInput) => invoke<Task>("task_update", { id, patch }),
  taskComplete: (id: string, done: boolean) => invoke<void>("task_complete", { id, done }),
  taskDelete: (id: string) => invoke<void>("task_delete", { id }),
  taskSetTags: (taskId: string, tagIds: string[]) =>
    invoke<void>("task_set_tags", { taskId, tagIds }),
  taskTags: () => invoke<Record<string, string[]>>("task_tags"),
  placementUpsert: (input: PlacementInput) => invoke<Placement>("placement_upsert", { input }),
  placementRemove: (taskId: string) => invoke<void>("placement_remove", { taskId }),
  placementSetMomentum: (input: MomentumInput) =>
    invoke<Placement>("placement_set_momentum", { input }),
  tagsBundle: () => invoke<{ groups: TagGroup[]; tags: Tag[] }>("tags_bundle"),
  tagGroupSave: (input: {
    id?: string;
    name: string;
    mode: "single" | "multi";
    isFree: boolean;
    color?: string | null;
  }) => invoke<TagGroup[]>("tag_group_save", input),
  tagGroupDelete: (id: string) => invoke<TagGroup[]>("tag_group_delete", { id }),
  tagSave: (input: { id?: string; groupId: string; name: string; color?: string | null }) =>
    invoke<Tag[]>("tag_save", input),
  tagDelete: (id: string) => invoke<Tag[]>("tag_delete", { id }),
  statsWeek: () => invoke<StatsPayload>("stats_week"),
  settingsSet: (key: string, value: string) =>
    invoke<Record<string, string>>("settings_set", { key, value }),
  backupNow: () => invoke<string>("backup_now"),
  dataDir: () => invoke<string>("data_dir"),
};

export async function setStatus(id: string, status: TaskStatus) {
  return repo.taskUpdate(id, { status });
}
