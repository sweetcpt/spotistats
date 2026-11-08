import { Schema } from "effect";

import {
  DiscoveryCandidate as CandidateSchema,
  type DiscoveryCandidate,
  type DiscoveryMode,
  type Mood,
  matchesMood,
  moodAttributes,
  selectDiscoveryTracks,
} from "~/lib/discovery";
import { accountApi } from "./api";
import {
  type CatalogTrack, CreatedPlaylist, createPrivatePlaylist, getAudioFeatures, getCatalogTracks,
  getDiscoveryTopTracks, getProfile, getRecommendations, getSavedTrackFlags, runSpotify, setDiscoveryPlaylistTracks,
} from "./spotify";
import { authStore } from "./storage";

const usable = (track: CatalogTrack | null): track is CatalogTrack & { id: string } =>
  !!track?.id && !track.is_local && track.is_playable !== false && !track.restrictions;

const candidate = (track: CatalogTrack & { id: string }, source: "new" | "rediscover", reason: string): DiscoveryCandidate => ({
  id: track.id, name: track.name, artistNames: track.artists.map((artist) => artist.name).join(", "),
  artistKey: track.artists[0]?.id ?? track.artists[0]?.name ?? track.id,
  imageUrl: track.album.images[0]?.url ?? null, externalUrl: track.external_urls.spotify, source, reason,
});

const currentToken = () => {
  const store = authStore();
  if (store.status !== "authenticated") throw new Error("请先登录 Spotify。");
  return store.accessToken;
};

export async function generateDiscovery(mode: DiscoveryMode, mood: Mood) {
  const token = currentToken();
  const [profile, history] = await Promise.all([runSpotify(getProfile()), accountApi.discoveryHistory()]);
  let seeds = history.seeds;
  if (mode !== "rediscover" && seeds.length === 0) {
    seeds = (await runSpotify(getDiscoveryTopTracks())).items.filter(usable).slice(0, 5).map((track) => track.id);
  }
  let fresh: DiscoveryCandidate[] = [];
  const old: DiscoveryCandidate[] = [];
  if (mode !== "rediscover") {
    if (!seeds.length) throw new Error("Spotify 还没有可用于生成推荐的热门曲目，先听几首歌再试。");
    const recommendations = await runSpotify(getRecommendations(seeds, moodAttributes[mood]));
    const tracks = recommendations.tracks.slice(0, 100).filter(usable);
    const ids = [...new Set(tracks.flatMap((track) => [track.id, ...(track.linked_from ? [track.linked_from.id] : [])]))];
    const known = new Set(await accountApi.discoveryKnown(ids));
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const flags = await runSpotify(getSavedTrackFlags(batch));
      if (flags.length !== batch.length) throw new Error("Spotify 返回的收藏检查结果不完整，请重试。");
      flags.forEach((saved, index) => { if (saved) known.add(batch[index]!); });
    }
    fresh = tracks.filter((track) => !known.has(track.id) && !known.has(track.linked_from?.id ?? ""))
      .map((track) => candidate(track, "new", "根据你的收藏生成的 Spotify 推荐；未出现在已记录的播放记录和喜欢的歌曲中。"));
  }
  if (mode !== "new" && history.rediscovery.length) {
    const features = mood === "any" ? null : await runSpotify(getAudioFeatures(history.rediscovery.map((track) => track.id).join(",")));
    if (features && features.length !== history.rediscovery.length) throw new Error("Spotify 返回的音频特征不完整，请重试。");
    const eligible = history.rediscovery.filter((_, index) => matchesMood(mood, features?.[index]));
    for (let offset = 0; offset < eligible.length; offset += 50) {
      const batch = eligible.slice(offset, offset + 50);
      const catalog = await runSpotify(getCatalogTracks(batch.map((track) => track.id)));
      if (catalog.tracks.length !== batch.length) throw new Error("Spotify 返回的曲目信息不完整，请重试。");
      catalog.tracks.forEach((track, index) => {
        const previous = batch[index];
        if (!previous || !usable(track)) return;
        old.push(candidate(track, "rediscover", `${previous.listens} tracked plays; last played ${new Date(previous.lastPlayedAtMs).toLocaleDateString()}.`));
      });
    }
  }
  if (currentToken() !== token) throw new Error("你的 Spotify 会话已变化，请重新生成推荐。");
  return { ownerId: profile.id, tracks: selectDiscoveryTracks(fresh, old, mode) };
}

export const DiscoveryDraft = Schema.Struct({
  ownerId: Schema.String,
  name: Schema.String,
  tracks: Schema.Array(CandidateSchema).check(Schema.isMaxLength(30)),
  playlist: Schema.NullOr(CreatedPlaylist),
  stage: Schema.Literals(["review", "creating", "filling", "saved"]),
});
export type DiscoveryDraft = typeof DiscoveryDraft.Type;
const draftKey = "spotistats-discovery-draft";

export function readDiscoveryDraft(): DiscoveryDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey);
    return raw ? Schema.decodeUnknownSync(DiscoveryDraft)(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function writeDiscoveryDraft(draft: DiscoveryDraft) {
  // Persist before every write so reloads cannot silently repeat playlist creation.
  sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

export function clearDiscoveryDraft() {
  sessionStorage.removeItem(draftKey);
}

export async function saveDiscoveryPlaylist(draft: DiscoveryDraft, update: (draft: DiscoveryDraft) => void) {
  const token = currentToken();
  const profile = await runSpotify(getProfile());
  if (currentToken() !== token) throw new Error("你的 Spotify 会话已变化，请重新打开「发现」后再试。");
  if (profile.id !== draft.ownerId) throw new Error("这批推荐属于另一个 Spotify 账号，请重新生成。");
  if (!draft.tracks.length) throw new Error("请至少选择一首曲目。");
  if (draft.stage === "creating") throw new Error("Spotify 可能已经创建了播放列表，但响应丢失了。重新开始之前，请先到 Spotify 里确认。");
  if (draft.stage === "saved") return;
  const persist = (next: DiscoveryDraft) => { writeDiscoveryDraft(next); update(next); return next; };
  if (!draft.playlist) {
    draft = persist({ ...draft, stage: "creating" });
    // Never retry this POST: Spotify may have created it even if the response was lost.
    const playlist = await runSpotify(createPrivatePlaylist(draft.name.trim() || "Spotistats 发现"));
    if (currentToken() !== token) throw new Error("你的 Spotify 会话已变化，重新开始之前请先到 Spotify 里确认播放列表。");
    draft = { ...draft, playlist, stage: "filling" };
    // Keep the returned ID in memory even if storage fills after creation.
    update(draft);
    writeDiscoveryDraft(draft);
  }
  if (currentToken() !== token) throw new Error("你的 Spotify 会话已变化，请重新打开「发现」后再试。");
  await runSpotify(setDiscoveryPlaylistTracks(draft.playlist!.id, draft.tracks.map((track) => track.id)));
  if (currentToken() !== token) throw new Error("你的 Spotify 会话已变化，请到 Spotify 里确认已保存的播放列表。");
  persist({ ...draft, stage: "saved" });
}

export function discoveryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("403") || message.includes("404")) {
    return "Spotify 拒绝了此操作。部分应用的推荐与音频特征接口受限。若是保存操作，请重新以播放列表权限授权。系统不会生成替代结果。";
  }
  if (message.includes("429")) return "Spotify 正在限制请求频率，请稍后再试。";
  return message;
}
