# TaskBoard

本地优先的「8 张承诺图」：把待办拆成树，再把要做的节点手动拖到周一…周日 / 周图上，用位置表达重要性 × 紧迫性。

## 现在能做什么

- 任务树：项目 / 任务 / 子任务，标准 checkbox 级联完成，拖拽排序，右键拆解。
- 8 张图：周一…周日 + 周图；周图聚合 7 天日板；单行周日历切换，不翻周。
- 日终顺延：当天未完成、也没手动移动/移除的节点，自动移到下一天（周日 → 周一）。
- 动量：有截止日时 x 朝 100 推进；无截止日按默认速度（默认 0.25 点/天）右移；右键可改。
- 截止日继承：自己没设截止日时，逐层继承父任务；详情里显示来源。
- 详情：标题、状态、标签组、截止日 + 可选 TipTap 说明（支持待办列表、图片 URL）。
- 筛选：文本 / 状态 / 标签 / 截止；每张图独立筛选。
- 周统计：本周完成 / 逾期列表。
- 设置：标签组、默认动量、着色依据（项目/标签组）、立即备份。
- 数据：SQLite 单文件 + WAL，本地 `%APPDATA%\com.yao.taskboard\data.db`。

## 技术栈

- React 19 + TypeScript + Vite
- Zustand / Tailwind CSS v4
- D3（scale / axis / selection / drag）
- TipTap 3
- Tauri 2 + Rust + `rusqlite`（bundled）
- Biome + Vitest

## 开发

Rust 工具链路径（已加入用户 PATH）：

```powershell
$env:PATH = "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;$env:PATH"
```

安装与启动：

```powershell
pnpm install
pnpm tauri dev
```

只预览前端（浏览器里没有 SQLite，会提示后端不可用）：

```powershell
pnpm dev
```

检查与构建：

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build
```

安装包输出在 `src-tauri/target/release/bundle/`。配置为 NSIS，不内置 WebView2 运行时。

实测体积：安装包 **1.94 MB**，`taskboard.exe` **4.61 MB**。

### 图标

应用图标与网页 favicon 由同一个脚本生成，设计常量集中在 `scripts/generate-icons.py`：

```powershell
python scripts/generate-icons.py
```

产物：`src-tauri/icons/`（各尺寸 PNG、`icon.ico`、`icon.icns`、Store 徽标）与 `public/favicon.svg`；
同目录的 `icon-preview.png` 是 16→256px 的尺寸预览，不参与打包。

设计：深色圆角底板 + 2×2 四象限格子，左上「重要不紧急」用强调绿并带勾选，其余为面板色空格；
16/24/32px 会自动放大格间距做光学补偿。

注意：Cargo 不把 `icons/*.ico` 当作 build script 的输入，换图标后若产物仍是旧图标，先清一次：

```powershell
cargo clean -p taskboard --manifest-path src-tauri/Cargo.toml
```

E2E 冒烟（需先带调试端口启动应用）：

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
pnpm tauri dev
# 另开终端
node scripts/verify.mjs
```


## 目录

```
docs/                     # 思路、选型、需求、概要设计、开发步骤
src/
  components/             # 图、树、详情、拆解、统计、设置
  data/                   # 类型与 Tauri repository
  lib/                    # 日期/板、筛选、树工具
  store/                  # Zustand
src-tauri/src/lib.rs      # SQLite schema、命令、顺延/动量/统计
scripts/verify.mjs        # E2E 冒烟（CDP 连接运行中的应用）
scripts/generate-icons.py # 生成 Tauri 图标与 favicon
```

## v1 边界

已实现：建项目 / 拆解 / 拖上图 / 拖动 / 详情 / 笔记 / 标签组 / 截止日继承 / 日终顺延 / 动量 / 每板筛选 / 周统计 / 手动备份 / NSIS 打包。

暂未做：

- 循环任务（`recurrence` 字段已预留）。
- 系统通知，只做应用内到期/逾期徽标。
- AI API / CLI / MCP（设计已留边界，后续接）。
- 多用户/共享/实时。
- 翻周与历史周；只显示当前周。
- 图片只支持 URL 插入；本地附件托管与任意文件路径引用未做 UI。
- 每日自动备份（目前为手动“立即备份”）。
- 树内鼠标拖拽排序（键盘 `Alt+↑/↓` 已可用）。

## 文档

- [01 思路整理](docs/20261114-01-任务面板/01-思路整理.md)
- [02 技术选型](docs/20261114-01-任务面板/02-技术选型.md)
- [03 需求分析](docs/20261114-01-任务面板/03-需求分析.md)
- [04 概要设计](docs/20261114-01-任务面板/04-概要设计.md)
- [05 开发步骤](docs/20261114-01-任务面板/05-开发步骤.md)
- [06 网络版规划](docs/20261114-01-任务面板/06-网络版规划.md)
