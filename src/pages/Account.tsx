import { useLocation, useNavigate } from "@solidjs/router";
import {
  action,
  createEffect,
  createMemo,
  createSignal,
  Loading,
  onSettled,
  refresh,
  Show,
  untrack,
} from "solid-js";

import { accountApi } from "~/client/api";
import { capture } from "~/client/analytics";
import { PageHeader } from "~/components/PageHeader";
import { authorizationNeedsReconnect } from "~/lib/authorization";
import { downloadTextFile } from "~/lib/download";
import { errorMessage } from "~/lib/errors";
import { formatDate } from "~/lib/format";
import { createShortcut, isEditableShortcutTarget } from "~/lib/shortcut";

/** Fixed reason codes the worker puts on a failed stats handshake. */
const statsFailureMessages: Record<string, string> = {
  spotify_denied: "Spotify 未授予访问权限。",
  spotify_credentials: "Spotify 拒绝了应用的凭证。",
  missing_code: "Spotify 未返回授权码。",
  missing_state: "Spotify 授权握手缺少 state 参数。",
  invalid_state: "Spotify 授权握手已过期或无效。",
  internal_error: "Spotify 授权握手在服务端失败。",
};

export default function AccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Snapshot the one-shot result before the effect below clears the query. The
  // OAuth callback owns the URL, so read the browser's copy rather than the
  // router's: it stays in step after the clear below.
  const snapshot = untrack(() =>
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    ),
  );
  const [statsResult] = createSignal(snapshot.get("stats"));
  const statsFailure = snapshot.get("reason");

  // A failed stats handshake is a setup problem, not page content. Clear the
  // one-shot query so a boundary retry does not rethrow, then hand the error to
  // the boundary, which shows it and reports it to PostHog. The worker sends a
  // fixed reason code, which keeps the failure diagnosable without leaking the
  // underlying cause.
  if (typeof window !== "undefined" && statsResult() === "failed") {
    window.history.replaceState(
      null,
      "",
      window.location.pathname || "/account",
    );
    // Keep the conversion funnel event; the boundary reports the error itself.
    capture("stats_sync_failed", { reason: statsFailure });
    const explanation = statsFailure
      ? statsFailureMessages[statsFailure]
      : undefined;
    throw new Error(
      `连接 Spotify 播放统计未完成。${
        explanation ? ` ${explanation}` : ""
      } 请重试连接；若持续失败，请反馈此问题。`,
    );
  }

  const stats = createMemo(() => accountApi.status());

  // The stats connect flow lands back here with its outcome in the query
  // string. Report success once so the enable funnel is visible.
  onSettled(() => {
    if (statsResult() === "enabled") capture("stats_sync_enabled", {});
  });

  createEffect(
    () => location.search,
    (search) => {
      if (search) navigate("/account", { replace: true });
    },
  );

  const [disabling, setDisabling] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [exporting, setExporting] = createSignal<"json" | "csv" | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);

  const runDisable = action(function* () {
    yield accountApi.disable();
    yield refresh(stats);
  });

  const runDelete = action(function* () {
    yield accountApi.deleteData();
    yield refresh(stats);
  });

  const disableStats = async () => {
    if (disabling()) return;
    setDisabling(true);
    setActionError(null);
    try {
      await runDisable();
      capture("stats_sync_disabled", {});
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setDisabling(false);
    }
  };

  const deleteAccountData = async () => {
    if (deleting()) return;
    if (
      !confirm(
        "确定删除本站存储的该账号的全部 Spotistats 数据？此操作也会停止统计同步。",
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      await runDelete();
      try { sessionStorage.removeItem("spotistats-discovery-draft"); } catch { /* Storage may be blocked. */ }
      capture("account_data_deleted", {});
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const exportListeningData = async (format: "json" | "csv") => {
    if (exporting()) return;
    setExporting(format);
    setActionError(null);
    try {
      if (format === "json") {
        const data = await accountApi.exportJson();
        downloadTextFile(
          "spotistats-listening-data.json",
          JSON.stringify(data, null, 2),
          "application/json",
        );
      } else {
        const csv = await accountApi.exportCsv();
        downloadTextFile("spotistats-listening-data.csv", csv);
      }
      capture("listening_data_exported", { format });
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  createShortcut(
    ["Shift", "D"],
    (event) => {
      if (isEditableShortcutTarget(event)) return;
      void disableStats();
    },
    { preventDefault: false },
  );

  return (
    <main class="app-main p-8 md:p-12">
      <PageHeader title="账号" eyebrow="统计同步" />

      <Show when={statsResult() === "enabled"}>
        <pre class="overflow-auto p-4 text-xs mb-6 border-4 border-[#0a0a0a] bg-[#1DB954] text-[#0a0a0a]">
          <samp>
            播放统计已连接，近期播放记录将很快同步。
          </samp>
        </pre>
      </Show>

      <Show when={actionError()}>
        {(value) => (
          <pre class="overflow-auto p-4 text-xs mb-6 text-red-600 border-4 border-[#0a0a0a] bg-[#0a0a0a]">
            <samp>操作失败：{value()}</samp>
          </pre>
        )}
      </Show>

      <Loading fallback={<p class="text-sm uppercase tracking-widest text-[#5c5c5c]">加载中_</p>}>
        <section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          <div class="contents">
            <div class="p-5 border-4 border-[#0a0a0a] lg:col-start-1 lg:row-start-1">
              <div class="text-xs uppercase tracking-[0.2em] mb-3 text-[#5c5c5c]">
                播放统计
              </div>
              <h2 class="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-4">
                {stats().enabled ? "已启用" : "已停用"}
              </h2>
              <p class="text-sm max-w-xl mb-6 leading-[1.7] text-[#555]">
                启用后，Spotistats 会安全存储你最近播放的 Spotify 曲目，逐步积累你的播放统计。
              </p>
              <Show
                when={stats().enabled}
                fallback={
                  <div class="mb-6 border-[3px] border-[#0a0a0a] bg-[#fff7c2] p-4 text-sm leading-7 text-[#3b3200]">
                    <p class="mb-1 font-black uppercase tracking-tight">
                      播放统计已停用
                    </p>
                    <p>
                      连接 Spotify 统计以同步近期播放，逐步构建你的数据面板。
                    </p>
                  </div>
                }
              >
                <Show
                  when={authorizationNeedsReconnect(
                    stats().consentedAt,
                    Date.now(),
                  )}
                >
                  <div class="mb-6 border-[3px] border-[#0a0a0a] bg-[#fff7c2] p-4 text-sm leading-7 text-[#3b3200]">
                    <p class="mb-1 font-black uppercase tracking-tight">
                      Spotify 授权即将过期
                    </p>
                    <p>
                      Spotify 登录有效期为六个月。请在{" "}
                      {formatDate(stats().authorizationExpiresAt)} 前重新连接，以免同步中断。
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/account/stats/login";
                      }}
                      class="mt-3 font-black text-sm uppercase tracking-widest py-3 px-6 transition border-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#f0ede8] hover:bg-[#1DB954] hover:text-black"
                    >
                      重新连接 Spotify 统计 →
                    </button>
                  </div>
                </Show>
                <div class="grid gap-3 text-xs uppercase tracking-widest mb-4 text-[#666]">
                  <p>
                    <span class="font-black text-[#0a0a0a]">已授权：</span>{" "}
                    {formatDate(stats().consentedAt)}
                  </p>
                  <p>
                    <span class="font-black text-[#0a0a0a]">上次同步：</span>{" "}
                    {formatDate(stats().lastSuccessAt)}
                  </p>
                  <p>
                    <span class="font-black text-[#0a0a0a]">最近播放：</span>{" "}
                    {formatDate(stats().lastPlayedAtMs)}
                  </p>
                  <p>
                    <span class="font-black text-[#0a0a0a]">已记录播放次数：</span>{" "}
                    {stats().listenCount.toLocaleString()}
                  </p>
                </div>
                <p class="mb-6 text-xs leading-6 text-[#5c5c5c]">
                  若连续 6 个月未打开数据面板，统计同步会自动暂停。
                </p>
              </Show>
              <Show when={stats().lastError}>
                {(error) => (
                  <pre class="overflow-auto p-4 text-xs mb-6 border-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#f0ede8]">
                    <samp>{error()}</samp>
                  </pre>
                )}
              </Show>
              <Show
                when={stats().enabled}
                fallback={
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/account/stats/login";
                    }}
                    class="font-black text-sm uppercase tracking-widest py-4 px-8 transition border-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#f0ede8] hover:bg-[#1DB954] hover:text-black"
                  >
                    连接 Spotify 统计 →
                  </button>
                }
              >
                <div class="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={disabling()}
                    onClick={disableStats}
                    class="font-black text-sm uppercase tracking-widest py-4 px-8 transition disabled:opacity-50 border-4 border-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
                    title="快捷键：Shift+D"
                  >
                    {disabling() ? "停用中_" : "停用统计 (Shift+D)"}
                  </button>
                </div>
              </Show>
            </div>
            <div class="p-5 border-4 border-[#0a0a0a] bg-[#f8f5ef] lg:col-start-2 lg:row-start-1">
              <div class="text-xs uppercase tracking-[0.2em] mb-3 text-[#5c5c5c]">
                导出你的数据
              </div>
              <h2 class="text-2xl font-black uppercase tracking-tighter leading-none mb-3">
                你的播放记录，随时带走
              </h2>
              <p class="text-sm max-w-xl mb-5 leading-[1.7] text-[#555]">
                下载 Spotistats 为该账号存储的每一条播放记录：曲目、艺人、专辑、播放来源和时间戳。导出不会停止同步，也不会改动已存储的数据。
              </p>
              <div class="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={exporting() !== null}
                  onClick={() => void exportListeningData("json")}
                  class="font-black text-sm uppercase tracking-widest py-4 px-8 transition disabled:opacity-50 border-4 border-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
                >
                  {exporting() === "json" ? "准备中_" : "下载 JSON ↓"}
                </button>
                <button
                  type="button"
                  disabled={exporting() !== null}
                  onClick={() => void exportListeningData("csv")}
                  class="font-black text-sm uppercase tracking-widest py-4 px-8 transition disabled:opacity-50 border-4 border-[#0a0a0a] hover:bg-[#1DB954] hover:text-black"
                >
                  {exporting() === "csv" ? "准备中_" : "下载 CSV ↓"}
                </button>
              </div>
            </div>
            <div class="p-5 border-4 border-red-800 lg:col-start-1 lg:row-start-2">
              <div class="text-xs uppercase tracking-[0.2em] mb-3 text-red-700">
                危险操作
              </div>
              <p class="text-sm max-w-xl mb-5 leading-[1.7] text-[#555]">
                删除 Spotistats 为该 Spotify 账号存储的全部数据。此操作也会停止统计同步。
              </p>
              <button
                type="button"
                disabled={deleting()}
                onClick={deleteAccountData}
                class="font-black text-sm uppercase tracking-widest py-4 px-8 text-red-700 transition disabled:opacity-50 border-4 border-red-800 hover:bg-red-700 hover:text-[#f0ede8]"
              >
                {deleting() ? "删除中_" : "删除本站数据"}
              </button>
            </div>
          </div>
        </section>
      </Loading>

      <p class="mt-10 text-[0.65rem] uppercase tracking-widest text-[#5c5c5c]">
        <a href="/privacy" class="underline hover:text-[#0a0a0a]">
          隐私
        </a>
        {" · "}
        <a href="/security" class="underline hover:text-[#0a0a0a]">
          安全
        </a>
      </p>
    </main>
  );
}
