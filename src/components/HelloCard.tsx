import { CheckCircle2, Database, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchHello, type HelloPayload, runningInTauri } from "../lib/hello";

type State =
  | { kind: "loading" }
  | { kind: "ready"; payload: HelloPayload }
  | { kind: "error"; message: string };

export function HelloCard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const payload = await fetchHello();
      setState({ kind: "ready", payload });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inTauri = runningInTauri();

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <Database size={14} className="text-emerald-300" />
        <h3 className="text-xs font-medium tracking-wide text-[var(--t2)]">Rust ↔ SQLite 连通性</h3>
        <span
          className={[
            "ml-auto rounded-full px-2 py-0.5 text-[10px]",
            inTauri ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300",
          ].join(" ")}
        >
          {inTauri ? "Tauri 桌面端" : "浏览器预览"}
        </span>
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
          <RefreshCw size={13} className="animate-spin" />
          正在调用 Rust command 并读取 SQLite…
        </div>
      )}

      {state.kind === "ready" && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-2 text-xs text-emerald-200">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{state.payload.message}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <dt className="text-[var(--t3)]">SQLite</dt>
            <dd className="text-right font-mono text-[var(--t2)]">{state.payload.sqliteVersion}</dd>
            <dt className="text-[var(--t3)]">App</dt>
            <dd className="text-right font-mono text-[var(--t2)]">v{state.payload.appVersion}</dd>
            <dt className="text-[var(--t3)]">数据位置</dt>
            <dd className="text-right text-[var(--t3)]">%APPDATA%/com.yao.taskboard</dd>
          </dl>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-xs text-amber-200">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{state.message}</span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--t2)] hover:bg-[var(--hover)]"
          >
            <RefreshCw size={12} />
            重试
          </button>
        </div>
      )}
    </section>
  );
}
