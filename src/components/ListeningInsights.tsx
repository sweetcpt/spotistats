import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import type { ListeningInsights as ListeningInsightsData } from "~/api";
import { capture } from "~/client/analytics";
import { formatDate } from "~/lib/format";
import {
  busiestIndex,
  formatDay,
  formatDayShort,
  formatHour,
  formatListeningTime,
  formatMonth,
  listeningHours,
  percentage,
  weekdayNames,
} from "~/lib/insights";
import { externalHref } from "~/lib/url";

/** Counts up once data arrives; static at once for reduced-motion users. */
function AnimatedNumber(props: {
  value: number;
  format?: (value: number) => string;
}) {
  const [display, setDisplay] = createSignal(0);

  createEffect(
    () => props.value,
    (target) => {
      const reduced =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || target === 0) {
        setDisplay(target);
        return;
      }

      const started = performance.now();
      const duration = 900;
      let frame = 0;
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(target * eased);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frame);
    },
  );

  return (
    <>{props.format ? props.format(display()) : Math.round(display()).toLocaleString()}</>
  );
}

function StatCard(props: {
  label: string;
  value: JSX.Element;
  detail: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <div
      class={`insight-rise border-4 border-[#0a0a0a] p-5 ${
        props.accent ? "bg-[#1DB954] text-[#0a0a0a]" : "bg-transparent"
      }`}
      style={`animation-delay:${props.delay}ms`}
    >
      <div class="mb-3 text-[0.65rem] font-black uppercase tracking-[0.25em] opacity-70">
        {props.label}
      </div>
      <div class="text-3xl font-black uppercase leading-none tracking-tighter md:text-4xl">
        {props.value}
      </div>
      <p class="mt-3 text-xs leading-6 opacity-75">{props.detail}</p>
    </div>
  );
}

function BucketChart(props: {
  label: string;
  values: ReadonlyArray<number>;
  labels: (index: number) => string;
  highlight?: number | null;
}) {
  const max = () => Math.max(1, ...props.values);
  return (
    <figure aria-label={props.label}>
      <div
        class="flex h-36 items-end gap-[3px] border-b-4 border-[#0a0a0a] pb-1"
        role="img"
        aria-label={props.label}
      >
        <For each={props.values}>
          {(count, index) => (
            <div
              class="group relative flex-1"
              style={`height:${Math.max(2, (count / max()) * 100)}%`}
              title={`${props.labels(index())}：${count.toLocaleString()}`}
              aria-hidden="true"
            >
              <div
                class={`insight-bar h-full w-full origin-bottom ${
                  index() === props.highlight ? "bg-[#1DB954]" : "bg-[#0a0a0a]"
                }`}
                style={`animation-delay:${index() * 24}ms`}
              />
            </div>
          )}
        </For>
      </div>
      <div class="mt-2 flex justify-between text-[0.6rem] font-black uppercase tracking-widest text-[#5c5c5c]">
        <span>{props.labels(0)}</span>
        <span>{props.labels(Math.floor(props.values.length / 2))}</span>
        <span>{props.labels(props.values.length - 1)}</span>
      </div>
    </figure>
  );
}

/**
 * Two series over the same buckets: plays as bars and listening time as a
 * line. They answer different questions, so a month with more plays but a
 * shorter bar-line gap is a month of shorter tracks, not of less listening.
 */
function TimeVsPlaysChart(props: {
  label: string;
  buckets: ReadonlyArray<{ listens: number; listeningMs: number }>;
  labels: (index: number) => string;
}) {
  const maxListens = () => Math.max(1, ...props.buckets.map((bucket) => bucket.listens));
  const maxMs = () => Math.max(1, ...props.buckets.map((bucket) => bucket.listeningMs));
  const lastIndex = () => Math.max(1, props.buckets.length - 1);
  const xPercent = (index: number) =>
    props.buckets.length === 1 ? 50 : (index / lastIndex()) * 100;
  const yPercent = (listeningMs: number) => 100 - (listeningMs / maxMs()) * 100;
  const points = () =>
    props.buckets
      .map((bucket, index) => `${xPercent(index)},${yPercent(bucket.listeningMs)}`)
      .join(" ");

  return (
    <figure aria-label={props.label}>
      <div class="relative h-40 border-b-4 border-[#0a0a0a]">
        <div class="flex h-full items-end gap-[3px]">
          <For each={props.buckets}>
            {(bucket, index) => (
              <div
                class="relative flex-1"
                style={`height:${Math.max(2, (bucket.listens / maxListens()) * 100)}%`}
                title={`${props.labels(index())}：${bucket.listens.toLocaleString()} 次播放，${formatListeningTime(bucket.listeningMs)}`}
                aria-hidden="true"
              >
                <div
                  class="insight-bar h-full w-full origin-bottom bg-[#0a0a0a]"
                  style={`animation-delay:${index() * 24}ms`}
                />
              </div>
            )}
          </For>
        </div>
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={points()}
            fill="none"
            stroke="#1DB954"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <For each={props.buckets}>
          {(bucket, index) => (
            <span
              class="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border border-[#0a0a0a] bg-[#1DB954]"
              style={`left:${xPercent(index())}%;top:${yPercent(bucket.listeningMs)}%`}
              aria-hidden="true"
            />
          )}
        </For>
      </div>
      <div class="mt-2 flex justify-between text-[0.6rem] font-black uppercase tracking-widest text-[#5c5c5c]">
        <span>{props.labels(0)}</span>
        <span>{props.labels(Math.floor(props.buckets.length / 2))}</span>
        <span>{props.labels(props.buckets.length - 1)}</span>
      </div>
    </figure>
  );
}

function InsightsContent(props: { data: ListeningInsightsData }) {
  const busiestHour = () => busiestIndex(props.data.hours);
  const busiestWeekday = () => busiestIndex(props.data.weekdays);
  const peak = createMemo(() => {
    const hour = busiestHour();
    return hour === null ? null : { hour, listens: props.data.hours[hour] ?? 0 };
  });
  const topTrack = () => props.data.topTracks[0];
  const topArtist = () => props.data.topArtists[0];
  const repeatShare = () =>
    percentage(topTrack()?.listens ?? 0, props.data.totals.listens);
  const discoveryShare = () =>
    percentage(props.data.onePlayTracks, props.data.totals.tracks);
  const lateNightShare = () =>
    percentage(props.data.lateNightListens, props.data.totals.listens);
  const averagePerDay = () =>
    props.data.totals.activeDays === 0
      ? 0
      : Math.round(props.data.totals.listens / props.data.totals.activeDays);
  const trendUnitLabel = () => (props.data.trendUnit === "day" ? "天" : "月");
  const averageTrackTime = () =>
    props.data.totals.listens === 0
      ? "—"
      : formatListeningTime(
          props.data.totals.listeningMs / props.data.totals.listens,
        );

  return (
    <div class="space-y-10">
      <section class="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="累计播放次数"
          value={<AnimatedNumber value={props.data.totals.listens} />}
          detail={`累计 ${props.data.totals.activeDays.toLocaleString()} 个活跃天数，平均每天约 ${averagePerDay()} 次播放。`}
          delay={0}
          accent
        />
        <StatCard
          label="收听时长"
          value={
            <AnimatedNumber
              value={listeningHours(props.data.totals.listeningMs)}
              format={(value) => `${value.toFixed(1)}小时`}
            />
          }
          detail={`${formatListeningTime(props.data.totals.listeningMs)} 的曲目，按整首时长计算，含跳过的部分。`}
          delay={80}
        />
        <StatCard
          label="艺人"
          value={<AnimatedNumber value={props.data.totals.artists} />}
          detail={`${props.data.totals.tracks.toLocaleString()} 首不同曲目，含合作曲目。`}
          delay={160}
        />
        <StatCard
          label="连续天数"
          value={`${props.data.streak.current} ${props.data.streak.current === 1 ? "天" : "天"}`}
          detail={
            props.data.streak.longest > props.data.streak.current
              ? `你的最长纪录是 ${props.data.streak.longest} 天，截至 ${formatDay(props.data.streak.longestEndedOn ?? "")}。`
              : "保持下去：每天听一次，纪录就不会断。"
          }
          delay={240}
        />
      </section>

      <section class="grid gap-6 border-4 border-[#0a0a0a] p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
        <div>
          <div class="mb-1 flex items-baseline justify-between gap-4">
            <h3 class="text-xl font-black uppercase tracking-tight">收听时段</h3>
            <span class="text-[0.65rem] font-black uppercase tracking-widest text-[#5c5c5c]">
              本地时间
            </span>
          </div>
          <p class="mb-5 max-w-xl text-xs leading-6 text-[#5c5c5c]">
            一天中每小时的播放次数，逐时堆叠。你的峰值：{" "}
            <Show when={peak()} fallback="加载中">
              {(value) => (
                <strong class="text-[#0a0a0a]">
                  {formatHour(value().hour)}，共{" "}
                  {value().listens.toLocaleString()} 次播放
                </strong>
              )}
            </Show>
            。
          </p>
          <BucketChart
            label="按本地时间每小时统计的播放次数"
            values={props.data.hours}
            labels={(index) => formatHour(index)}
            highlight={busiestHour()}
          />
        </div>
        <div class="grid content-start gap-4">
          <div class="border-[3px] border-[#0a0a0a] bg-[#fff7c2] p-4">
            <div class="mb-2 text-[0.65rem] font-black uppercase tracking-[0.25em] text-[#3b3200]">
              夜猫指数
            </div>
            <p class="text-3xl font-black uppercase leading-none tracking-tighter">
              {lateNightShare()}%
            </p>
            <p class="mt-2 text-xs leading-6 text-[#3b3200]">
              的播放发生在晚上 10 点以后，那是终于属于自己的时间。
            </p>
          </div>
          <div class="border-[3px] border-[#0a0a0a] p-4">
            <div class="mb-2 text-[0.65rem] font-black uppercase tracking-[0.25em] text-[#5c5c5c]">
              最常听的一天
            </div>
            <p class="text-3xl font-black uppercase leading-none tracking-tighter">
              {busiestWeekday() === null
                ? "—"
                : weekdayNames[busiestWeekday() ?? 0]}
            </p>
            <p class="mt-2 text-xs leading-6 text-[#555]">
              {(props.data.weekdays[busiestWeekday() ?? 0] ?? 0).toLocaleString()}{" "}
              次播放，出现在你最活跃的那天。
            </p>
          </div>
        </div>
      </section>

      <section class="border-4 border-[#0a0a0a] p-5 md:p-8">
        <div class="mb-1 flex flex-wrap items-baseline justify-between gap-4">
          <h3 class="text-xl font-black uppercase tracking-tight">
            收听时长与播放次数
          </h3>
          <span class="flex items-center gap-4 text-[0.6rem] font-black uppercase tracking-widest text-[#5c5c5c]">
            <span class="flex items-center gap-2">
              <span class="inline-block h-3 w-3 border-[2px] border-[#0a0a0a] bg-[#0a0a0a]" />
              播放次数
            </span>
            <span class="flex items-center gap-2">
              <span class="inline-block h-[3px] w-5 bg-[#1DB954]" />
              小时
            </span>
          </span>
        </div>
        <p class="mb-5 max-w-2xl text-xs leading-6 text-[#5c5c5c]">
          柱状图表示每{trendUnitLabel()}的播放次数，绿线表示收听时长。两者通常
          同步升降；一旦分化，说明你每{" "}
          {trendUnitLabel()}听的曲目变短或变长了。你平均每首曲目{" "}
          <strong class="text-[#0a0a0a]">{averageTrackTime()}</strong>。
        </p>
        <Show
          when={props.data.trend.length > 0}
          fallback={
            <p class="border-[3px] border-dashed border-[#0a0a0a] p-4 text-xs text-[#555]">
              该时间范围内没有历史记录。
            </p>
          }
        >
          <TimeVsPlaysChart
            label={`按${props.data.trendUnit}统计的播放次数与收听时长`}
            buckets={props.data.trend}
            labels={(index) => {
              const bucket = props.data.trend[index]?.bucket ?? "";
              return props.data.trendUnit === "day"
                ? formatDayShort(bucket)
                : formatMonth(bucket);
            }}
          />
        </Show>
      </section>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="border-4 border-[#0a0a0a] p-5 md:p-6">
          <div class="mb-1 flex items-baseline justify-between gap-4">
            <h3 class="text-xl font-black uppercase tracking-tight">
            收听趋势
          </h3>
            <span class="text-[0.65rem] font-black uppercase tracking-widest text-[#5c5c5c]">
              {props.data.trendUnit === "day" ? "每日" : "每月"}
            </span>
          </div>
          <p class="mb-5 text-xs leading-6 text-[#5c5c5c]">
            {props.data.trendUnit === "day"
              ? "该范围内每天的播放次数。播放少的日子也照常显示，空白一目了然。"
              : "该范围内每月的播放次数。柱子按相对高度绘制，清淡的月份也能一眼看出。"}
          </p>
          <Show
            when={props.data.trend.length > 0}
            fallback={
              <p class="border-[3px] border-dashed border-[#0a0a0a] p-4 text-xs text-[#555]">
                该时间范围内没有历史记录。
              </p>
            }
          >
            <BucketChart
              label={`按${props.data.trendUnit}统计的播放次数`}
              values={props.data.trend.map((bucket) => bucket.listens)}
              labels={(index) => {
                const bucket = props.data.trend[index]?.bucket ?? "";
                return props.data.trendUnit === "day"
                  ? formatDayShort(bucket)
                  : formatMonth(bucket);
              }}
            />
          </Show>
        </div>

        <div class="border-4 border-[#0a0a0a] p-5 md:p-6">
          <div class="mb-1 flex items-baseline justify-between gap-4">
            <h3 class="text-xl font-black uppercase tracking-tight">循环播放</h3>
            <span class="text-[0.65rem] font-black uppercase tracking-widest text-[#5c5c5c]">
              常听艺人
            </span>
          </div>
          <p class="mb-5 text-xs leading-6 text-[#5c5c5c]">
            你播放次数最多的艺人，含合作曲目。
          </p>
          <Show
            when={props.data.topArtists.length > 0}
            fallback={
              <p class="border-[3px] border-dashed border-[#0a0a0a] p-4 text-xs text-[#555]">
                该时间范围内没有艺人记录。
              </p>
            }
          >
            <For each={props.data.topArtists}>
              {(artist, index) => (
                <div class="mb-4">
                  <div class="mb-1 flex items-baseline justify-between gap-4">
                    <span class="min-w-0 truncate text-sm font-black uppercase tracking-tight">
                      <span class="mr-2 text-[#5c5c5c]">{index() + 1}</span>
                      {artist.name}
                    </span>
                    <span class="shrink-0 text-[0.65rem] font-bold uppercase tracking-widest text-[#5c5c5c]">
                      {artist.listens.toLocaleString()} 次播放
                    </span>
                  </div>
                  <div class="h-3 border-[2px] border-[#0a0a0a]">
                    <div
                      class="insight-stretch h-full origin-left bg-[#0a0a0a]"
                      style={`width:${Math.max(
                        4,
                        (artist.listens / (props.data.topArtists[0]?.listens ?? 1)) * 100,
                      )}%;animation-delay:${index() * 80}ms`}
                    />
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </section>

      <section class="border-4 border-[#0a0a0a] p-5 md:p-6">
        <div class="mb-1 flex items-baseline justify-between gap-4">
          <h3 class="text-xl font-black uppercase tracking-tight">播放最多的曲目</h3>
          <span class="text-[0.65rem] font-black uppercase tracking-widest text-[#5c5c5c]">
            前 5 名
          </span>
        </div>
        <p class="mb-5 text-xs leading-6 text-[#5c5c5c]">
          {topTrack()
            ? `${topTrack()?.name} 占该时间范围内播放次数的 ${repeatShare()}%。`
            : "该时间范围内没有曲目记录。"}
        </p>
        <Show
          when={props.data.topTracks.length > 0}
          fallback={
            <p class="border-[3px] border-dashed border-[#0a0a0a] p-4 text-xs text-[#555]">
              该时间范围内没有曲目记录。
            </p>
          }
        >
          <For each={props.data.topTracks}>
            {(track, index) => (
              <a
                href={externalHref(track.externalUrl) ?? "#"}
                target="_blank"
                rel="noopener"
                onClick={() =>
                  capture("spotify_item_opened", {
                    kind: "track",
                    surface: "insights",
                  })
                }
                class="insight-rise flex items-center gap-4 border-b-[3px] border-[#0a0a0a] py-3 transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
                style={`animation-delay:${index() * 60}ms`}
              >
                <span class="w-7 shrink-0 text-lg font-black text-[#5c5c5c]">
                  {index() + 1}
                </span>
                <img
                  src={track.imageUrl ?? "/assets/placeholder.svg"}
                  alt={track.name}
                  class="h-12 w-12 shrink-0 border-2 border-[#0a0a0a] object-cover"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-black uppercase tracking-tight">
                    {track.name}
                  </p>
                  <p class="mt-0.5 truncate text-xs text-[#5c5c5c]">
                    {track.artistNames}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-black">{track.listens.toLocaleString()}</p>
                  <p class="text-[0.6rem] uppercase tracking-widest text-[#5c5c5c]">
                    次播放
                  </p>
                </div>
              </a>
            )}
          </For>
        </Show>
      </section>

      <section class="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="长尾曲目"
          value={`${discoveryShare()}%`}
          detail={`该时间范围内，有 ${props.data.onePlayTracks.toLocaleString()} 首只听过一次的曲目。`}
          delay={0}
        />
        <StatCard
          label="高频循环"
          value={`${repeatShare()}%`}
          detail={
            topTrack()
              ? `${topTrack()?.name} 是该时间范围内你重复播放最多的曲目。`
              : "还没有重复播放最多的曲目。"
          }
          delay={60}
        />
        <StatCard
          label="常听艺人"
          value={topArtist()?.name ?? "—"}
          detail={
            topArtist()
              ? `${topArtist()?.listens.toLocaleString()} 次播放，覆盖 ${topArtist()?.tracks.toLocaleString()} 首曲目。`
              : "首次同步后才会生成排名。"
          }
          delay={120}
        />
        <StatCard
          label="最活跃的一天"
          value={
            props.data.busiestDay
              ? `${props.data.busiestDay.listens.toLocaleString()} 次播放`
              : "—"
          }
          detail={
            props.data.busiestDay
              ? `${formatDay(props.data.busiestDay.date)} 那天，你根本停不下来。`
              : "还没有特别突出的一天。"
          }
          delay={180}
        />
      </section>
    </div>
  );
}

export function ListeningInsights(props: {
  data: ListeningInsightsData;
  onReload: () => void;
  rangeLabel: string;
  controls?: JSX.Element;
  preview?: boolean;
  onExitPreview?: () => void;
}) {
  return (
    <section
      id="insights"
      aria-labelledby="insights-heading"
      class="scroll-mt-28 space-y-6"
    >
      <Show when={props.preview}>
        <div
          class="insight-rise border-4 border-[#0a0a0a] bg-[#fff7c2] p-4 md:p-5"
          role="status"
        >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="mb-1 text-xs font-black uppercase tracking-[0.25em] text-[#3b3200]">
                示例数据
              </p>
              <p class="max-w-2xl text-sm leading-6 text-[#3b3200]">
                这是连接收听统计后你能看到的洞察预览。这些播放记录
                都不来自你的账号。
              </p>
            </div>
            <button
              type="button"
              onClick={props.onExitPreview}
              class="shrink-0 border-[3px] border-[#0a0a0a] px-3 py-2 text-[0.65rem] font-black uppercase tracking-widest transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
            >
              退出预览
            </button>
          </div>
        </div>
      </Show>

      <div class="flex flex-wrap items-end justify-between gap-4 border-b-4 border-[#0a0a0a] pb-4">
        <div class="flex items-center gap-4">
          <div class="insight-vinyl h-12 w-12 shrink-0 rounded-full border-4 border-[#0a0a0a] bg-[#0a0a0a]">
            <div class="flex h-full w-full items-center justify-center">
              <div class="h-4 w-4 rounded-full border-[3px] border-[#0a0a0a] bg-[#1DB954]" />
            </div>
          </div>
          <div>
            <div class="mb-2 text-xs uppercase tracking-[0.25em] text-[#5c5c5c]">
              {props.preview ? "示例数据预览" : props.rangeLabel}
            </div>
            <h2
              id="insights-heading"
              class="flex flex-wrap items-center gap-3 text-3xl font-black uppercase leading-none tracking-tighter md:text-5xl"
            >
              收听洞察
              <span class="border-[3px] border-[#0a0a0a] bg-[#1DB954] px-2 py-1 text-[0.6rem] font-black uppercase tracking-widest">
                测试版
              </span>
            </h2>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Show when={!props.preview}>
            <span class="text-[0.65rem] font-black uppercase tracking-widest text-[#5c5c5c]">
              更新于 {formatDate(props.data.generatedAt)}
            </span>
            <button
              type="button"
              onClick={props.onReload}
              class="whitespace-nowrap border-[3px] border-[#0a0a0a] px-3 py-2 text-[0.65rem] font-black uppercase tracking-widest transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
            >
              重新加载
            </button>
          </Show>
          <Show when={props.preview}>
            <span class="border-[3px] border-[#0a0a0a] bg-[#1DB954] px-3 py-2 text-[0.65rem] font-black uppercase tracking-widest">
              预览
            </span>
          </Show>
        </div>
      </div>

      <Show when={props.controls}>
        <div>{props.controls}</div>
      </Show>

      <Show when={!props.preview && props.data.totals.listens === 0}>
        <div class="border-[3px] border-dashed border-[#0a0a0a] p-4 text-xs leading-6 text-[#555]">
          该时间范围内没有播放记录。试试扩大范围或换个日期。
        </div>
      </Show>

      <InsightsContent data={props.data} />
    </section>
  );
}
