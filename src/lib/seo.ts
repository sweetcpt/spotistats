export const siteUrl =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://spotistats.example";
export const siteName = "Spotistats";
export const siteTitle =
  "Spotistats — Spotify 听歌统计、历史记录与备份";
export const siteDescription =
  "Spotistats 是一款免费的 Spotify 统计应用，可保存你的听歌历史，展示最常听的艺人和连续收听记录，并支持导出歌单与播放数据。";
export const siteImage = `${siteUrl}/assets/og.png`;
export const siteImageAlt =
  "Spotistats — 解读你的 Spotify 听歌统计、历史记录与备份";
export interface SiteFaq {
  readonly question: string;
  readonly answer: string;
}

export const siteFaq: readonly SiteFaq[] = [
  {
    question: "Spotistats 是什么？",
    answer:
      "Spotistats 是一款免费的网页应用，可分析你的 Spotify 听歌历史并备份你的音乐。它会展示你最常听的艺人和曲目、连续收听记录、各时段的收听习惯，以及你这一年的收听全貌。",
  },
  {
    question: "它和 Spotify 年度回顾有什么不同？",
    answer:
      "年度回顾是 Spotify 每年推出的一次总结。Spotistats 则持续记录历史，你可以随时查看，还能看到 Spotify 未公开的统计，并导出这些数据。",
  },
  {
    question: "Spotistats 如何获取我的听歌历史？",
    answer:
      "你先连接 Spotify，再主动开启听歌统计同步。Spotistats 会保存 Spotify 返回的最近播放曲目，并在服务端构建你的历史记录。你可以随时在账户页面断开连接或删除数据。",
  },
  {
    question: "我能导出自己的 Spotify 数据吗？",
    answer:
      "可以。你可以把歌单导出为 CSV，也可以在账户页面把 Spotistats 保存的每一条听歌记录下载为 JSON 或 CSV。",
  },
  {
    question: "Spotistats 免费吗？",
    answer:
      "是的。Spotistats 完全免费，没有广告，也没有付费版本。",
  },
  {
    question: "Spotistats 会看到我的 Spotify 密码吗？",
    answer:
      "不会。登录通过 Spotify OAuth 完成，Spotistats 永远不会收到你的 Spotify 密码。",
  },
];

const titleByPath = (path: string) => {
  if (path === "/" || path === "/login") return siteTitle;
  if (path.startsWith("/favourites/tracks"))
    return "最爱的 Spotify 曲目 — Spotistats";
  if (path.startsWith("/favourites/albums"))
    return "收藏的 Spotify 专辑 — Spotistats";
  if (path.startsWith("/export"))
    return "导出你的 Spotify 数据 — Spotistats";
  if (path.startsWith("/account"))
    return "Spotify 统计账户 — Spotistats";
  if (path.startsWith("/discover")) return "发现音乐 — Spotistats";
  if (path.startsWith("/privacy")) return "隐私政策 — Spotistats";
  if (path.startsWith("/security")) return "安全政策 — Spotistats";
  return "Spotistats — 解读你的 Spotify";
};

export const titleForPath = (path: string) => titleByPath(path);

/**
 * The canonical URL for a path.
 *
 * Built from the deployment's configured site URL so each installation points
 * canonical tags at its own hostname.
 */
export const canonicalUrl = (path: string, search = "") => `${siteUrl}${path}${search}`;

/**
 * Routes that are reachable without a Spotify session. `/` and `/login` are the
 * sign-in screen; `/privacy` and `/security` are the public policy pages.
 */
export const isPublicPath = (path: string) =>
  path === "/" ||
  path === "/login" ||
  path === "/privacy" ||
  path === "/security";

/**
 * Public pages that are their own canonical URL rather than the home page.
 * The sign-in routes canonicalise to `/`; the policy pages stand alone.
 */
export const isContentPath = (path: string) =>
  path === "/privacy" || path === "/security";

/** Structured data for the public site. FAQ is only emitted for public pages. */
export function jsonLdFor(publicPage: boolean) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: siteName,
      description: siteDescription,
      inLanguage: "zh-CN",
      publisher: {
        "@type": "Person",
        name: "Oscar Beaumont",
        url: "https://otbeaumont.me",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: siteName,
      url: `${siteUrl}/`,
      description: siteDescription,
      applicationCategory: "MusicApplication",
      operatingSystem: "Web",
      browserRequirements: "需要启用 JavaScript",
      isAccessibleForFree: true,
      inLanguage: "zh-CN",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      creator: {
        "@type": "Person",
        name: "Oscar Beaumont",
        url: "https://otbeaumont.me",
      },
      sameAs: ["https://github.com/oscartbeaumont/spotistats"],
      screenshot: siteImage,
      featureList: [
        "Spotify 听歌历史",
        "常听艺人与曲目",
        "连续收听天数与时段分布",
        "播放列表导出",
        "播放数据导出",
      ],
    },
  ];

  if (publicPage) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: siteFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
