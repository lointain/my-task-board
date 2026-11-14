import { invoke, isTauri } from "@tauri-apps/api/core";

export interface HelloPayload {
  message: string;
  sqliteVersion: string;
  appVersion: string;
}

export function runningInTauri(): boolean {
  return isTauri();
}

export async function fetchHello(): Promise<HelloPayload> {
  if (!isTauri()) {
    throw new Error("浏览器预览模式没有 Rust/SQLite 后端；请用 `pnpm tauri dev` 启动桌面端。");
  }
  return invoke<HelloPayload>("hello");
}
