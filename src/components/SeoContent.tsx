import { For } from "solid-js";

import { siteFaq } from "~/lib/seo";

const features = [
  {
    title: "长期留存的听歌记录",
    detail:
      "Spotify 只展示很短的一段近期记录。Spotistats 会持续累积历史，让你的统计随时间越来越完整。",
  },
  {
    title: "最常听的艺人与曲目",
    detail:
      "历年最爱的、当月循环的，还有你总忍不住重听的那些曲目。",
  },
  {
    title: "连续天数与听歌习惯",
    detail:
      "连续听歌天数、时段分布、星期偏好，以及你这一年的全貌。",
  },
  {
    title: "备份与导出",
    detail:
      "把歌单下载成 CSV，或把 Spotistats 存下的每一次播放导出为 JSON 或 CSV。",
  },
  {
    title: "自主开启，保护隐私",
    detail:
      "是否同步统计由你决定。听歌记录始终归你所有，随时可以删除。",
  },
  {
    title: "免费，无广告",
    detail: "一个专心呈现你音乐数据的面板，而不是又一条信息流。",
  },
];

/** Public, indexable product copy shown below the sign-in screen. */
export function SeoContent(props: {
  onConnect: () => void;
  signingIn: boolean;
}) {
  return (
    <section
      aria-labelledby="about-spotistats"
      class="border-t-4 border-[#0a0a0a] px-5 py-14 md:px-10 lg:px-12"
    >
      <div class="mx-auto grid w-full max-w-[1440px] gap-12 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div>
          <div class="text-[0.65rem] uppercase tracking-[0.25em] text-[#5c5c5c]">
            关于 Spotistats
          </div>
          <h2
            id="about-spotistats"
            class="mt-3 max-w-4xl text-3xl font-black uppercase leading-none tracking-tighter md:text-5xl"
          >
            比 Wrapped 更长久的 Spotify 听歌统计。
          </h2>
          <p class="mt-5 max-w-3xl text-sm leading-7 text-[#555]">
            Spotistats 是一款免费的 Spotify 听歌统计与历史记录工具。Spotify 只提供一小段最近播放和一年一次的 Wrapped 回顾；Spotistats 则留住更长的视角：随时间累积的常听艺人与曲目、连续听歌天数、时段习惯，以及你这一年的全貌。歌单可随时备份，存下的听歌数据也能随时导出。
          </p>

          <div class="mt-8 grid gap-3 sm:grid-cols-2">
            <For each={features}>
              {(feature) => (
                <div class="border-[3px] border-[#0a0a0a] p-4">
                  <h3 class="text-xs font-black uppercase tracking-widest">
                    {feature.title}
                  </h3>
                  <p class="mt-2 text-xs leading-6 text-[#5c5c5c]">
                    {feature.detail}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>

        <div>
          <div class="text-[0.65rem] uppercase tracking-[0.25em] text-[#5c5c5c]">
            常见问题
          </div>
          <h2 class="mt-3 text-2xl font-black uppercase leading-none tracking-tighter md:text-3xl">
            Spotify 统计，一次说清。
          </h2>
          <div class="mt-6 space-y-3">
            <For each={siteFaq}>
              {(item) => (
                <div class="border-[3px] border-[#0a0a0a] p-4">
                  <h3 class="text-xs font-black uppercase tracking-wide">
                    {item.question}
                  </h3>
                  <p class="mt-2 text-xs leading-6 text-[#5c5c5c]">
                    {item.answer}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="mx-auto mt-12 flex w-full max-w-[1440px] flex-col gap-5 border-4 border-[#0a0a0a] bg-[#1DB954] p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <div class="text-[0.65rem] font-black uppercase tracking-[0.2em]">
            你的音乐，有据可查
          </div>
          <p class="mt-2 max-w-2xl text-lg font-black uppercase leading-tight tracking-tight md:text-2xl">
            连接 Spotify，看你的听歌记录渐渐成形。
          </p>
        </div>
        <button
          type="button"
          disabled={props.signingIn}
          onClick={props.onConnect}
          class="shrink-0 border-4 border-[#0a0a0a] bg-[#0a0a0a] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#f0ede8] transition hover:bg-[#f0ede8] hover:text-[#0a0a0a] disabled:opacity-60"
        >
          {props.signingIn ? "连接中_" : "连接 Spotify →"}
        </button>
      </div>
    </section>
  );
}
