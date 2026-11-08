import {
  action,
  createEffect,
  createMemo,
  createSignal,
  For,
  isPending,
  latest,
  onSettled,
  Show,
} from "solid-js";

import { accountApi } from "~/client/api";
import { capture, identifyUser } from "~/client/analytics";
import {
  getCurrentlyPlaying,
  getProfile,
  runSpotify,
  SpotifyProfile,
} from "~/client/spotify";
import { setAuthStore } from "~/client/storage";
import { ListeningInsights } from "~/components/ListeningInsights";
import {
  ProfileHeaderSkeleton,
  StatsRailSkeleton,
} from "~/components/ProfileSkeleton";
import { errorMessage } from "~/lib/errors";
import { formatDate } from "~/lib/format";
import {
  DAY_MS,
  browserTimezoneOffset,
  formatDay,
  localDay,
} from "~/lib/insights";
import { createPreviewInsights } from "~/lib/previewInsights";
import { createShortcut, isEditableShortcutTarget } from "~/lib/shortcut";
import { reuseUnchanged } from "~/lib/stable";
import { externalHref } from "~/lib/url";
import type {
  InsightsQuery,
  InsightsRange,
  ListeningInsights as ListeningInsightsData,
  TrackingStatus,
} from "~/api";

type ProfileUser = typeof SpotifyProfile.Type;

const fetchStatus = async (): Promise<TrackingStatus> => {
  try {
    return await accountApi.status();
  } catch (error) {
    return {
      enabled: false,
      consentedAt: null,
      authorizationExpiresAt: null,
      lastReadAt: null,
      disabledAt: null,
      lastPlayedAtMs: null,
      lastSuccessAt: null,
      lastError: errorMessage(error),
      listenCount: 0,
      recent: [],
    };
  }
};

interface InsightsState {
  data: ListeningInsightsData | null;
  error: string | null;
}

const localDateStart = (value: string) => {
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const localDateEnd = (value: string) => {
  const ms = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const fetchInsights = async (query: InsightsQuery): Promise<InsightsState> => {
  try {
    return {
      data: await accountApi.insights(query),
      error: null,
    };
  } catch (error) {
    return { data: null, error: errorMessage(error) };
  }
};

function ProfileHeader(props: { user: ProfileUser }) {
  return (
    <header class="content-fade-in order-1 border-b-4 border-[#0a0a0a] pb-6 xl:col-start-1 xl:row-start-1">
      <div class="flex flex-wrap items-start gap-5">
        <a
          href={externalHref(props.user.external_urls.spotify)}
          target="_blank"
          rel="noopener"
          class="shrink-0"
        >
          <img
            src={props.user.images?.[0]?.url ?? "/assets/placeholder.svg"}
            alt={props.user.display_name ?? "头像"}
            class="h-24 w-24 border-4 border-[#0a0a0a] object-cover md:h-28 md:w-28"
          />
        </a>
        <div class="min-w-0 flex-1">
          <div class="mb-1 text-[0.65rem] uppercase tracking-[0.25em] text-[#5c5c5c]">
            你的个人资料
          </div>
          <h1 class="text-4xl font-black uppercase leading-none tracking-tighter md:text-5xl">
            {props.user.display_name ?? props.user.id}
          </h1>
          <p class="mt-2 truncate text-xs uppercase tracking-widest text-[#666]">
            {props.user.email}
          </p>
          <div class="mt-2 flex items-center gap-2">
            <span class="text-sm font-bold">
              {props.user.followers.total.toLocaleString()}
            </span>
            <span class="text-[0.65rem] uppercase tracking-widest text-[#666]">
              关注者
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 md:ml-auto">
          <a
            href="/favourites/tracks"
            class="border-[3px] border-[#0a0a0a] px-4 py-2 text-[0.65rem] font-black uppercase tracking-widest transition hover:bg-[#1DB954] hover:text-black"
          >
            常听音乐 →
          </a>
          <a
            href={externalHref(props.user.external_urls.spotify)}
            target="_blank"
            rel="noopener"
            class="border-[3px] border-[#0a0a0a] px-4 py-2 text-[0.65rem] font-black uppercase tracking-widest transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
          >
            打开 Spotify ↗
          </a>
        </div>
      </div>
    </header>
  );
}

function StatsRail(props: {
  status: TrackingStatus;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div class="content-fade-in space-y-4 xl:sticky xl:top-24">
      <section class="border-4 border-[#0a0a0a] p-5">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs uppercase tracking-[0.2em] text-[#5c5c5c]">
              最近收听
            </div>
            <p class="mt-1 text-[0.6rem] uppercase tracking-widest text-[#666]">
              {props.status.lastSuccessAt
                ? `同步于 ${formatDate(props.status.lastSuccessAt)}`
                : "Spotify 统计"}
            </p>
          </div>
          <button
            type="button"
            disabled={props.refreshing || !props.status.enabled}
            onClick={props.onRefresh}
            class="shrink-0 border-[3px] border-[#0a0a0a] px-2 py-1.5 text-[0.6rem] font-black uppercase tracking-widest transition disabled:opacity-40 hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
            title="快捷键：R"
          >
            {props.refreshing ? "排队中_" : "刷新 (R)"}
          </button>
        </div>
        <Show
          when={props.status.enabled}
          fallback={
            <div class="border-[3px] border-dashed border-[#0a0a0a] p-4">
              <p class="text-xs font-black uppercase tracking-tight">
                统计未开启
              </p>
              <p class="mt-2 text-xs leading-6 text-[#555]">
                连接统计后，最近的播放记录会显示在这里。
              </p>
              <a
                href="/account"
                class="mt-3 inline-block text-[0.65rem] font-black uppercase tracking-widest underline"
              >
                连接统计 →
              </a>
            </div>
          }
        >
          <Show
            when={props.status.recent.length > 0}
            fallback={
              <div class="border-[3px] border-dashed border-[#0a0a0a] p-4">
                <p class="text-xs font-black uppercase tracking-tight">
                  暂无收听数据
                </p>
                <p class="mt-2 text-xs leading-6 text-[#555]">
                  点击「刷新」发起同步，等 Spotify 返回最近播放记录后，
                  这里就会更新。
                </p>
              </div>
            }
          >
            <div>
              <For each={props.status.recent}>
                {(item) => (
                  <a
                    href={externalHref(item.externalUrl) ?? "#"}
                    target="_blank"
                    rel="noopener"
                    onClick={() =>
                      capture("spotify_item_opened", {
                        kind: "track",
                        surface: "recent",
                      })
                    }
                    class="flex items-center gap-3 border-b-[3px] border-[#0a0a0a] py-3 text-left transition last:border-b-0 hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
                  >
                    <img
                      src={item.imageUrl ?? "/assets/placeholder.svg"}
                      alt={item.name}
                      class="h-9 w-9 shrink-0 border-2 border-[#0a0a0a] object-cover"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs font-black uppercase tracking-tight">
                        {item.name}
                      </p>
                      <p class="mt-0.5 truncate text-[0.65rem] text-[#5c5c5c]">
                        {item.artistNames}
                      </p>
                      <p class="mt-0.5 text-[0.6rem] uppercase tracking-widest text-[#5c5c5c]">
                        {formatDate(item.playedAt)}
                      </p>
                    </div>
                  </a>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </section>

      <section class="border-4 border-[#0a0a0a] p-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-xs uppercase tracking-[0.2em] text-[#5c5c5c]">
            统计同步
          </div>
          <span
            class={`border-[3px] border-[#0a0a0a] px-2 py-1 text-[0.6rem] font-black uppercase tracking-widest ${
              props.status.enabled
                ? "bg-[#1DB954] text-[#0a0a0a]"
                : "bg-[#0a0a0a] text-[#f0ede8]"
            }`}
          >
            {props.status.enabled ? "开启" : "关闭"}
          </span>
        </div>
        <Show
          when={props.status.enabled}
          fallback={
            <p class="text-xs leading-6 text-[#555]">
              开启统计，才能留存 Spotify 未公开的收听历史。
            </p>
          }
        >
          <dl class="space-y-2 text-[0.6rem] uppercase tracking-widest text-[#666]">
            <div class="flex items-baseline justify-between gap-2">
              <dt>上次同步</dt>
              <dd class="text-right font-bold text-[#0a0a0a]">
                {formatDate(props.status.lastSuccessAt)}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <dt>最近一次播放</dt>
              <dd class="text-right font-bold text-[#0a0a0a]">
                {formatDate(props.status.lastPlayedAtMs)}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <dt>累计播放次数</dt>
              <dd class="text-right font-bold text-[#0a0a0a]">
                {props.status.listenCount.toLocaleString()}
              </dd>
            </div>
          </dl>
        </Show>
        <Show when={props.status.lastError}>
          {(error) => (
            <p class="mt-3 text-[0.65rem] leading-5 text-red-700">{error()}</p>
          )}
        </Show>
        <a
          href="/account"
          class="mt-3 inline-block text-[0.65rem] font-black uppercase tracking-widest underline"
        >
          管理统计 →
        </a>
      </section>
    </div>
  );
}

const rangeOptions: ReadonlyArray<{ value: InsightsRange; label: string }> = [
  { value: "week", label: "近7天" },
  { value: "month", label: "近30天" },
  { value: "sixMonths", label: "近6个月" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自定义" },
];

function InsightsRangeControl(props: {
  value: InsightsRange;
  fromDate: string;
  toDate: string;
  updating: boolean;
  onChange: (value: InsightsRange) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <span class="mr-1 text-[0.6rem] font-black uppercase tracking-[0.2em] text-[#5c5c5c]">
        时间范围
      </span>
      <For each={rangeOptions}>
        {(option) => (
          <button
            type="button"
            aria-pressed={props.value === option.value ? "true" : "false"}
            onClick={() => props.onChange(option.value)}
            class={`border-[3px] border-[#0a0a0a] px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-widest transition ${
              props.value === option.value
                ? "bg-[#0a0a0a] text-[#f0ede8]"
                : "hover:bg-[#1DB954] hover:text-black"
            }`}
          >
            {option.label}
          </button>
        )}
      </For>
      <Show when={props.value === "custom"}>
        <label class="flex items-center gap-2 border-[3px] border-[#0a0a0a] px-2 py-1 text-[0.55rem] font-black uppercase tracking-widest text-[#5c5c5c]">
          起始
          <input
            type="date"
            value={props.fromDate}
            max={props.toDate || undefined}
            onInput={(event) => props.onFromChange(event.currentTarget.value)}
            class="bg-transparent text-[0.6rem] font-bold uppercase tracking-wider text-[#0a0a0a] outline-none"
          />
        </label>
        <label class="flex items-center gap-2 border-[3px] border-[#0a0a0a] px-2 py-1 text-[0.55rem] font-black uppercase tracking-widest text-[#5c5c5c]">
          结束
          <input
            type="date"
            value={props.toDate}
            min={props.fromDate || undefined}
            onInput={(event) => props.onToChange(event.currentTarget.value)}
            class="bg-transparent text-[0.6rem] font-bold uppercase tracking-wider text-[#0a0a0a] outline-none"
          />
        </label>
      </Show>
      <Show when={props.updating}>
        <span class="text-[0.6rem] font-black uppercase tracking-widest text-[#5c5c5c]">
          更新中_
        </span>
      </Show>
    </div>
  );
}

export default function ProfilePage() {
  const [tick, setTick] = createSignal(0);
  const [insightsTick, setInsightsTick] = createSignal(0);
  const [preview, setPreview] = createSignal<ListeningInsightsData | null>(null);
  const [refreshing, setRefreshing] = createSignal(false);
  const timezone = browserTimezoneOffset();
  const [range, setRange] = createSignal<InsightsRange>("all");
  const [fromDate, setFromDate] = createSignal(
    localDay(Date.now() - 29 * DAY_MS, timezone),
  );
  const [toDate, setToDate] = createSignal(localDay(Date.now(), timezone));

  const profile = createMemo(() => runSpotify(getProfile()));
  const stats = createMemo(() => {
    tick();
    return fetchStatus();
  });
  const currentlyPlaying = createMemo(() => {
    tick();
    return runSpotify(getCurrentlyPlaying());
  });
  const insights = createMemo(() => {
    insightsTick();
    const selected = range();
    return fetchInsights({
      tzOffset: timezone,
      range: selected,
      fromMs: selected === "custom" ? localDateStart(fromDate()) : null,
      toMs: selected === "custom" ? localDateEnd(toDate()) : null,
    });
  });

  // `latest` keeps the last settled value while a poll is in flight, so the
  // 10-second refresh does not tear down and re-mount the dashboard (which can
  // leave a `<Show>` child reading its narrowed accessor after it unmounts).
  // It only throws before the first value arrives, which is the skeleton case.
  const profileNow = () => {
    try {
      return latest(profile) ?? null;
    } catch {
      return null;
    }
  };
  const statsNow = () => {
    try {
      return latest(stats) ?? null;
    } catch {
      return null;
    }
  };
  // The dashboard polls every 10s and each poll parses fresh objects, so
  // `<For>` would rebuild the recent list (and reload its covers) every time.
  // Reuse the previous object for a row that has not changed.
  let previousRecent: TrackingStatus["recent"] = [];
  const stableStats = createMemo(() => {
    const status = statsNow();
    if (!status) return null;
    const recent = reuseUnchanged(
      previousRecent,
      status.recent,
      (item) => `${item.playedAtMs}:${item.name}`,
    );
    previousRecent = recent;
    return { ...status, recent };
  });
  const playingNow = () => {
    try {
      return latest(currentlyPlaying) ?? null;
    } catch {
      return null;
    }
  };
  const insightsNow = () => {
    try {
      return latest(insights) ?? null;
    } catch {
      return null;
    }
  };
  const insightsPending = () => {
    try {
      return isPending(insights);
    } catch {
      return false;
    }
  };
  const readyInsights = () => {
    const state = insightsNow();
    const status = statsNow();
    return state && status ? { state, status } : null;
  };

  const reloadInsights = () => setInsightsTick((value) => value + 1);
  const showPreview = () => {
    setPreview(createPreviewInsights());
    capture("insights_preview_opened", {});
  };
  const exitPreview = () => {
    setPreview(null);
    capture("insights_preview_exited", {});
  };

  const changeRange = (next: InsightsRange) => {
    setRange(next);
    capture("insights_range_changed", { range: next });
  };
  const changeFromDate = (value: string) => {
    setFromDate(value);
    if (value && toDate() && value > toDate()) setToDate(value);
  };
  const changeToDate = (value: string) => {
    setToDate(value);
    if (value && fromDate() && value < fromDate()) setFromDate(value);
  };
  const rangeLabel = () => {
    switch (range()) {
      case "week":
        return "近 7 天";
      case "month":
        return "近 30 天";
      case "sixMonths":
        return "近 6 个月";
      case "custom":
        return fromDate() && toDate()
          ? `${formatDay(fromDate())} – ${formatDay(toDate())}`
          : "自定义范围";
      default:
        return "全部时间";
    }
  };

  createEffect(
    () => profileNow(),
    (data) => {
      if (!data) return;
      const displayName = data.display_name ?? data.id;
      identifyUser(data.id, {
        username: displayName,
        email: data.email,
      });
      setAuthStore((current) =>
        current.status === "authenticated"
          ? {
              ...current,
              profile: {
                id: data.id,
                icon: data.images?.[0]?.url,
                url:
                  current.linkToUri && data.uri
                    ? data.uri
                    : data.external_urls.spotify,
                displayName,
                email: data.email,
                followers: data.followers.total,
              },
            }
          : current,
      );
    },
  );

  onSettled(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 10000);
    return () => clearInterval(interval);
  });

  const queueRefresh = action(function* () {
    yield accountApi.refresh();
    setTick((value) => value + 1);
    reloadInsights();
  });
  const refreshStats = async () => {
    if (refreshing() || !statsNow()?.enabled) return;
    setRefreshing(true);
    try {
      await queueRefresh();
      capture("stats_refresh_requested", {});
    } finally {
      setRefreshing(false);
    }
  };

  let lastListenCount: number | null = null;
  createEffect(
    () => statsNow()?.listenCount,
    (count) => {
      if (typeof count !== "number") return;
      if (lastListenCount === null) {
        lastListenCount = count;
        return;
      }
      if (count !== lastListenCount) {
        lastListenCount = count;
        reloadInsights();
      }
    },
  );

  createShortcut(
    ["r"],
    (event) => {
      if (isEditableShortcutTarget(event)) return;
      void refreshStats();
    },
    { preventDefault: false },
  );

  return (
    <main class="app-main flex-1 p-8 md:p-16">
      <div class="space-y-8">
        <Show when={playingNow()?.is_playing && playingNow()?.item}>
          {(track) => (
            <a
              href={externalHref(track().external_urls.spotify)}
              target="_blank"
              rel="noopener"
              class="content-fade-in group flex items-center gap-4 border-4 border-[#0a0a0a] bg-[#1DB954] p-4 text-[#0a0a0a] shadow-[8px_8px_0_#0a0a0a] transition hover:-translate-y-0.5 hover:shadow-[10px_10px_0_#0a0a0a]"
            >
              <img
                src={
                  track().album?.images?.[0]?.url ??
                  track().images?.[0]?.url ??
                  "/assets/placeholder.svg"
                }
                alt={track().name}
                class="h-16 w-16 shrink-0 border-[3px] border-[#0a0a0a] object-cover"
              />
              <div class="min-w-0 flex-1">
                <div class="mb-1 text-[0.65rem] font-black uppercase tracking-[0.25em]">
                  正在播放
                </div>
                <p class="truncate text-xl font-black uppercase tracking-tight md:text-2xl">
                  {track().name}
                </p>
                <p class="truncate text-xs font-bold uppercase tracking-widest opacity-75">
                  {track()
                    .artists?.map((artist) => artist.name)
                    .join(", ") ?? "Spotify"}
                </p>
              </div>
              <span class="hidden shrink-0 border-[3px] border-[#0a0a0a] px-3 py-2 text-xs font-black uppercase tracking-widest transition group-hover:bg-[#0a0a0a] group-hover:text-[#1DB954] md:inline-block">
                打开 Spotify →
              </span>
            </a>
          )}
        </Show>

        <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:items-start">
          <Show when={profileNow()} fallback={<ProfileHeaderSkeleton />}>
            {(user) => <ProfileHeader user={user()} />}
          </Show>

          <aside class="order-2 xl:col-start-2 xl:row-span-2 xl:row-start-1">
            <Show when={stableStats()} fallback={<StatsRailSkeleton />}>
              {(status) => (
                <StatsRail
                  status={status()}
                  refreshing={refreshing()}
                  onRefresh={refreshStats}
                />
              )}
            </Show>
          </aside>

          <div class="order-3 min-w-0 xl:col-start-1 xl:row-start-2">
            <Show when={preview()}>
              {(data) => (
                <div class="content-fade-in">
                  <ListeningInsights
                    data={data()}
                    onReload={reloadInsights}
                    rangeLabel="示例数据"
                    preview
                    onExitPreview={exitPreview}
                  />
                </div>
              )}
            </Show>
            <Show when={!preview() && readyInsights()}>
              {(ready) => (
                <div class="content-fade-in">
                  <Show
                    when={ready().state.data}
                    fallback={
                      <InsightsUnavailable
                        message={
                          ready().state.error ??
                          "收听洞察加载失败，请重试。"
                        }
                        onRetry={reloadInsights}
                        onPreview={showPreview}
                      />
                    }
                  >
                    {(data) => (
                      <Show
                        when={
                          data().totals.listens > 0 ||
                          ready().status.listenCount > 0
                        }
                        fallback={
                          <InsightsGate
                            status={ready().status}
                            refreshing={refreshing()}
                            onPreview={showPreview}
                            onRefresh={refreshStats}
                          />
                        }
                      >
                        <ListeningInsights
                          data={data()}
                          onReload={reloadInsights}
                          rangeLabel={rangeLabel()}
                          controls={
                            <InsightsRangeControl
                              value={range()}
                              fromDate={fromDate()}
                              toDate={toDate()}
                              updating={insightsPending()}
                              onChange={changeRange}
                              onFromChange={changeFromDate}
                              onToChange={changeToDate}
                            />
                          }
                        />
                      </Show>
                    )}
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </div>
      </div>
    </main>
  );
}

function InsightsGate(props: {
  status: TrackingStatus;
  refreshing: boolean;
  onPreview: () => void;
  onRefresh: () => void;
}) {
  return (
    <section
      id="insights"
      class="scroll-mt-28 border-4 border-[#0a0a0a] p-6 md:p-8"
    >
      <div class="mb-2 text-xs uppercase tracking-[0.25em] text-[#5c5c5c]">
        收听洞察
      </div>
      <h2 class="max-w-3xl text-3xl font-black uppercase leading-none tracking-tighter md:text-5xl">
        {props.status.enabled
          ? "你的首批播放记录正在路上"
          : "看看你的收听习惯说明了什么"}
      </h2>
      <p class="mt-4 max-w-2xl text-sm leading-7 text-[#555]">
        {props.status.enabled
          ? "统计同步已开启。Spotify 的最近播放记录稍后就会同步过来，页面届时会自动填充。"
          : "Spotistats 只会绘制你选择保存的播放记录。连接收听统计，就能积累一份 Spotify 不会保留的历史；也可以先用示例数据预览概览。"}
      </p>
      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="border-[3px] border-[#0a0a0a] p-4">
          <p class="text-xs font-black uppercase tracking-widest">
            常听艺人与曲目
          </p>
          <p class="mt-2 text-xs leading-6 text-[#5c5c5c]">
            全部时间里的心头好，而不只是 Spotify 最近 50 次播放。
          </p>
        </div>
        <div class="border-[3px] border-[#0a0a0a] p-4">
          <p class="text-xs font-black uppercase tracking-widest">收听时段</p>
          <p class="mt-2 text-xs leading-6 text-[#5c5c5c]">
            你的本地时段、星期分布，以及过去一年的整体轮廓。
          </p>
        </div>
        <div class="border-[3px] border-[#0a0a0a] p-4">
          <p class="text-xs font-black uppercase tracking-widest">连续天数与趣味数据</p>
          <p class="mt-2 text-xs leading-6 text-[#5c5c5c]">
            连续收听天数、长尾曲目，以及你的夜猫比例。
          </p>
        </div>
      </div>
      <Show when={props.status.lastError}>
        {(error) => (
          <pre class="mt-5 overflow-auto border-[3px] border-[#0a0a0a] bg-[#0a0a0a] p-3 text-xs text-red-500">
            <samp>{error()}</samp>
          </pre>
        )}
      </Show>
      <div class="mt-6 flex flex-wrap gap-3">
        <Show
          when={props.status.enabled}
          fallback={
            <a
              href="/account"
              class="border-4 border-[#0a0a0a] bg-[#0a0a0a] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#f0ede8] transition hover:bg-[#1DB954] hover:text-black"
            >
              连接收听统计 →
            </a>
          }
        >
          <button
            type="button"
            disabled={props.refreshing}
            onClick={props.onRefresh}
            class="border-4 border-[#0a0a0a] px-6 py-3 text-sm font-black uppercase tracking-wide transition disabled:opacity-50 hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
          >
            {props.refreshing ? "刷新中_" : "立即刷新"}
          </button>
        </Show>
        <button
          type="button"
          onClick={props.onPreview}
          class="border-4 border-[#0a0a0a] bg-[#1DB954] px-6 py-3 text-sm font-black uppercase tracking-wide transition hover:bg-[#0a0a0a] hover:text-[#1DB954]"
        >
          用示例数据预览 →
        </button>
      </div>
    </section>
  );
}

function InsightsUnavailable(props: {
  message: string;
  onRetry: () => void;
  onPreview: () => void;
}) {
  return (
    <section
      id="insights"
      class="scroll-mt-28 border-4 border-red-800 p-6 md:p-8"
    >
      <div class="mb-2 text-xs uppercase tracking-[0.2em] text-red-700">
        收听洞察
      </div>
      <h2 class="text-2xl font-black uppercase leading-none tracking-tighter">
        无法加载你的收听洞察
      </h2>
      <p class="mt-3 max-w-2xl text-sm leading-7 text-[#555]">{props.message}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onRetry}
          class="border-4 border-[#0a0a0a] px-6 py-3 text-sm font-black uppercase tracking-wide transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
        >
          重试
        </button>
        <button
          type="button"
          onClick={props.onPreview}
          class="border-4 border-[#0a0a0a] bg-[#1DB954] px-6 py-3 text-sm font-black uppercase tracking-wide transition hover:bg-[#0a0a0a] hover:text-[#1DB954]"
        >
          用示例数据预览 →
        </button>
      </div>
    </section>
  );
}
