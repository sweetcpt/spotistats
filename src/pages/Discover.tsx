import { createSignal, For, onSettled, Show } from "solid-js";

import { createLoginUrl } from "~/client/auth";
import {
  clearDiscoveryDraft, discoveryError, generateDiscovery, readDiscoveryDraft,
  saveDiscoveryPlaylist, writeDiscoveryDraft, type DiscoveryDraft,
} from "~/client/discovery";
import { getProfile, runSpotify } from "~/client/spotify";
import { discoveryEnabled } from "~/client/features";
import { authStore } from "~/client/storage";
import { PageHeader } from "~/components/PageHeader";
import type { DiscoveryMode, Mood } from "~/lib/discovery";
import { externalHref } from "~/lib/url";
import NotFoundPage from "./NotFound";

const control = "min-w-0 w-full border-[3px] border-[#0a0a0a] px-4 py-3 text-sm font-bold disabled:opacity-50";
const button = `${control} uppercase tracking-widest transition hover:bg-[#0a0a0a] hover:text-[#f0ede8]`;

/**
 * The route stays registered, but the flag decides whether the feature exists
 * for this person. Rendering the 404 keeps the rollout honest for everyone
 * else, and it matches how the nav link is hidden.
 */
export default function DiscoverPage() {
  return (
    <Show when={discoveryEnabled()} fallback={<NotFoundPage />}>
      <Discover />
    </Show>
  );
}

function Discover() {
  const [mode, setMode] = createSignal<DiscoveryMode>("blend");
  const [mood, setMood] = createSignal<Mood>("any");
  const [draft, setDraft] = createSignal<DiscoveryDraft | null>(null);
  const [busy, setBusy] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const hasPermission = () => {
    const session = authStore();
    return session.status === "authenticated" && session.scopes?.includes("playlist-modify-private");
  };
  const editable = () => draft()?.stage === "review" && !busy();
  const persist = (next: DiscoveryDraft) => { writeDiscoveryDraft(next); setDraft(next); };

  onSettled(() => {
    void (async () => {
      try {
        const previous = readDiscoveryDraft();
        if (previous) {
          const session = authStore();
          const profile = await runSpotify(getProfile());
          const current = authStore();
          if (session.status !== "authenticated" || current.status !== "authenticated" || session.accessToken !== current.accessToken) return;
          if (profile.id === previous.ownerId) setDraft(previous);
          else clearDiscoveryDraft();
        }
      } catch (cause) { setError(discoveryError(cause)); }
      finally { setBusy(false); }
    })();
  });

  const generate = async () => {
    if (busy()) return;
    if (draft()?.stage === "creating" && !confirm("Spotify 可能已创建你的播放列表，请先到 Spotify 查看。要放弃这次已保存的尝试并重新生成一组曲目吗？")) return;
    if (draft()?.stage === "filling" && !confirm("你的 Spotify 播放列表已存在，但可能不完整。要放弃这次已保存的尝试，而不重试吗？")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await generateDiscovery(mode(), mood());
      persist({ ...result, name: `Spotistats — ${mood() === "any" ? mode() : mood()}`, playlist: null, stage: "review" });
    } catch (cause) { setError(discoveryError(cause)); }
    finally { setBusy(false); }
  };

  const authorize = async () => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      const current = draft();
      if (current) writeDiscoveryDraft(current);
      window.location.href = await createLoginUrl(window.location.origin, true);
    } catch (cause) { setError(discoveryError(cause)); setBusy(false); }
  };

  const save = async () => {
    const current = draft();
    if (!current || busy()) return;
    setBusy(true);
    setError(null);
    try { await saveDiscoveryPlaylist(current, setDraft); }
    catch (cause) { setError(discoveryError(cause)); }
    finally { setBusy(false); }
  };

  return (
    <main class="app-main p-8 md:p-12">
      <PageHeader title="发现" eyebrow="发现你的下一首心头好" />
      <p class="mb-8 max-w-3xl text-sm leading-7 text-[#555]">
        新发现、旧爱，或两者兼顾。音乐由 Spotify 提供，Spotistats 最多挑选 30 首曲目，同一主要艺人不超过三首。在你查看并确认之前，不会向 Spotify 保存任何内容。
      </p>
      <section aria-label="发现选项" class="mb-8 grid gap-5 border-4 border-[#0a0a0a] p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label class="grid min-w-0 gap-2 text-xs font-black uppercase tracking-widest">
          选择方式
          <select class={`${control} bg-transparent`} value={mode()} disabled={busy()} onChange={(event) => setMode(event.currentTarget.value as DiscoveryMode)}>
            <option value="new">不在你的播放记录里</option>
            <option value="rediscover">重新发现</option>
            <option value="blend">混合</option>
          </select>
        </label>
        <label class="grid min-w-0 gap-2 text-xs font-black uppercase tracking-widest">
          氛围 / 场景
          <select class={`${control} bg-transparent`} value={mood()} disabled={busy()} onChange={(event) => setMood(event.currentTarget.value as Mood)}>
            <option value="any">不限氛围</option>
            <option value="chill">放松 — 低能量</option>
            <option value="focus">专注 — 器乐</option>
            <option value="workout">运动 — 高能量、节奏更快</option>
            <option value="upbeat">明快 — 明亮、有活力</option>
          </select>
        </label>
        <button type="button" class={`${button} bg-[#1DB954]`} disabled={busy()} onClick={() => void generate()}>
          {busy() ? "处理中…" : "生成曲目"}
        </button>
      </section>
      <div class="mb-8 max-w-3xl space-y-2 text-xs leading-6 text-[#555]">
        <p>“新”会排除你已记录的播放历史和喜欢的歌曲，但并不涵盖你听过的每一首歌或关注的每一个播放列表。</p>
        <p>“重新发现”选取至少播放过两次、且已 90 天未播放的曲目。<a class="font-bold underline" href="/account">连接播放统计</a> 以积累这段历史。</p>
        <p>氛围基于 Spotify 的音乐属性，而非推断的情绪。若推荐或音频特征接口受限，我们会如实提示，而不会用猜测的结果替代。不会向任何 AI 模型发送数据。</p>
      </div>
      <Show when={error()}>{(message) => <p role="alert" class="mb-6 border-4 border-red-800 p-4 text-sm leading-7">{message()}</p>}</Show>
      <Show when={draft()}>{(value) => (
        <section aria-label="查看曲目" class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b-4 border-[#0a0a0a] pb-4">
            <h2 class="text-2xl font-black uppercase tracking-tight">你的曲目 — {value().tracks.length} 首</h2>
            <span class="text-xs font-bold uppercase tracking-widest">音乐由 Spotify 提供</span>
          </div>
          <Show when={value().tracks.length === 0}>
            <p role="status" class="border-[3px] border-dashed border-[#0a0a0a] p-5 text-sm leading-7">没有匹配的曲目，试试其他氛围或选择方式。“重新发现”需要 90 天前、且重复播放过的记录；我们不会用无关的歌曲填补空缺。</p>
          </Show>
          <For each={value().tracks}>{(track, index) => (
            <div class="flex items-center gap-4 border-b-[3px] border-[#0a0a0a] py-3">
              <span class="w-6 shrink-0 text-sm font-black">{index() + 1}</span>
              <img class="h-12 w-12 shrink-0 border-2 border-[#0a0a0a] object-cover" src={track.imageUrl ?? "/assets/placeholder.svg"} alt="" />
              <div class="min-w-0 flex-1">
                <a class="block truncate text-sm font-black uppercase underline" href={externalHref(track.externalUrl) ?? "#"} target="_blank" rel="noopener noreferrer">{track.name}</a>
                <p class="truncate text-xs leading-6">{track.artistNames}</p>
                <p class="text-xs leading-6 text-[#555]">{track.reason}</p>
              </div>
              <Show when={editable()}>
                <button type="button" class="shrink-0 text-xs font-bold underline" aria-label={`移除 ${track.name}`} onClick={() => {
                  try { persist({ ...value(), tracks: value().tracks.filter((item) => item.id !== track.id) }); }
                  catch (cause) { setError(discoveryError(cause)); }
                }}>移除</button>
              </Show>
            </div>
          )}</For>
          <Show when={value().tracks.length > 0}>
            <label class="grid max-w-xl gap-2 text-xs font-black uppercase tracking-widest">
              播放列表名称
              <input class={`${control} bg-transparent`} maxlength={100} value={value().name} disabled={!editable()} onInput={(event) => {
                try { persist({ ...value(), name: event.currentTarget.value }); }
                catch (cause) { setError(discoveryError(cause)); }
              }} />
            </label>
            <Show when={!hasPermission()}>
              <p class="max-w-xl text-sm leading-7">保存需要你授权创建 Spotify 私密播放列表。重新连接期间，你的曲目会保留在当前标签页。</p>
              <button type="button" class={button} disabled={busy()} onClick={() => void authorize()}>允许创建私密播放列表</button>
            </Show>
            <Show when={hasPermission() && (value().stage === "review" || value().stage === "filling")}>
              <button type="button" class={`${button} bg-[#1DB954]`} disabled={busy() || !value().name.trim()} onClick={() => void save()}>
                {busy() ? "保存中…" : value().playlist ? "重试添加曲目" : "创建 Spotify 私密播放列表"}
              </button>
            </Show>
          </Show>
          <Show when={value().stage === "creating"}>
            <p role="status" class="border-4 border-[#0a0a0a] bg-[#fff7c2] p-4 text-sm leading-7">Spotify 可能已创建该播放列表，但我们尚未拿到它的 ID。生成新曲目之前，请先到 Spotify 查看播放列表。我们不会自动重复创建。</p>
          </Show>
          <Show when={value().playlist}>{(playlist) => (
            <p role="status" class="border-4 border-[#0a0a0a] p-4 text-sm leading-7">
              {value().stage === "saved" ? "播放列表已保存。" : "播放列表已创建；曲目是否保存成功尚未确认。重试可替换其中的曲目且不会产生重复。"}
              <a class="font-black underline" href={externalHref(playlist().external_urls.spotify) ?? "#"} target="_blank" rel="noopener noreferrer">在 Spotify 中打开 ↗</a>
            </p>
          )}</Show>
        </section>
      )}</Show>
    </main>
  );
}
