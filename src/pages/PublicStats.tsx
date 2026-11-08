import { createSignal, onSettled, Show } from "solid-js";

import type { ListeningInsights as InsightsData } from "~/api";
import { ListeningInsights } from "~/components/ListeningInsights";

/**
 * A session-free, read-only view of the instance's listening statistics.
 *
 * The worker resolves the single tracked account from D1, so no Spotify
 * bearer token is needed. Personal deployments can therefore show the
 * statistics page to a visitor who never signs in.
 */
export default function PublicStatsPage() {
  const [data, setData] = createSignal<InsightsData | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const tzOffset = -new Date().getTimezoneOffset();
      const response = await fetch(
        `/api/public/stats/insights?tzOffset=${tzOffset}&range=all`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as InsightsData);
    } catch {
      setError("统计数据加载失败，请稍后刷新重试。");
    } finally {
      setLoading(false);
    }
  };

  onSettled(() => void load());

  return (
    <div class="min-h-screen bg-[#f0ede8] text-[#0a0a0a]">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#0a0a0a] bg-[#f0ede8] p-4 sm:p-5">
        <span class="shrink-0 font-black text-xl tracking-tighter uppercase select-none">
          SPOTISTATS
        </span>
        <nav class="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
          <span class="text-[#5c5c5c]">只读统计</span>
          <a
            href="/login"
            class="border-4 border-[#0a0a0a] px-3 py-2 transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
          >
            登录管理
          </a>
        </nav>
      </header>

      <main class="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p class="text-xs font-black uppercase tracking-[0.25em] text-[#5c5c5c]">
          听歌记录 · 长期留存
        </p>
        <h1 class="mt-3 text-4xl font-black tracking-tighter sm:text-6xl">
          我的听歌统计
        </h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-[#5c5c5c]">
          无需登录即可查看。播放记录保存在你自己的 Cloudflare D1 数据库中，
          后台每 15 分钟自动同步一次。
        </p>

        <div class="mt-10">
          <Show when={loading()}>
            <div class="border-4 border-[#0a0a0a] p-8 text-sm font-bold uppercase tracking-widest text-[#5c5c5c]">
              正在加载统计数据…
            </div>
          </Show>

          <Show when={!loading() && error()}>
            <div class="border-4 border-[#0a0a0a] bg-[#fff7c2] p-8">
              <p class="text-sm font-bold">{error()}</p>
              <button
                type="button"
                onClick={() => void load()}
                class="mt-4 border-4 border-[#0a0a0a] bg-[#0a0a0a] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#f0ede8]"
              >
                重新加载
              </button>
            </div>
          </Show>

          <Show when={!loading() && !error() && data()}>
            {(insights) => (
              <ListeningInsights
                data={insights()}
                onReload={() => void load()}
                rangeLabel="全部时间"
              />
            )}
          </Show>
        </div>

        <p class="mt-12 border-t-4 border-[#0a0a0a] pt-6 text-xs leading-6 text-[#5c5c5c]">
          首次同步只包含 Spotify 返回的最近 50 条播放记录，之后会持续累积。
        </p>
      </main>
    </div>
  );
}
