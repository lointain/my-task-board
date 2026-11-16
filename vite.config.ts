import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // E2E 用的 WebView2 用户数据目录：不忽略的话它的 Code Cache 写入会被
      // watcher 当成源码变更，触发 full reload → 又写盘 → 无限重载
      ignored: ["**/src-tauri/**", "**/.webview2-e2e/**"],
    },
  },
}));
