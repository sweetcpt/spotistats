import { LegalLayout } from "~/components/LegalLayout";

/**
 * The privacy policy.
 *
 * It is a public, indexable route, so it lives outside the authenticated app
 * shell. Keep the copy in step with what `src/server/tracking.ts` stores.
 * Analytics are disabled unless the instance owner configures a PostHog project.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout title="隐私政策" updated="2026 年 10 月 22 日">
      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          简要说明
        </h2>
        <p>
          Spotistats 会读取你的 Spotify 账户和音乐数据，用来展示听歌统计并备份你的歌单。只有在你主动开启后，系统才会保存听歌历史；你随时可以在账户页面删除全部数据。Spotistats 永远不会获取你的 Spotify 密码。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          我们收集哪些信息
        </h2>
        <ul class="list-disc space-y-2 pl-5">
          <li>
            <strong>你的 Spotify 个人资料。</strong>当你使用 Spotify 登录时，我们会读取你的用户 ID、显示名称、邮箱、粉丝数和头像，以便应用显示当前登录的账户。
          </li>
          <li>
            <strong>你的听歌历史（需主动开启）。</strong>如果你开启听歌统计，服务器会保存 Spotify 返回的最近播放曲目——包括曲目、艺人、专辑、播放时间以及播放来源场景——从而积累一份 Spotify 本身并不保留的历史记录。
          </li>
          <li>
            <strong>你的音乐库，按需读取。</strong>热门曲目、收藏的专辑和歌单会直接在你的浏览器中从 Spotify 获取，用于渲染页面和导出，不会保存在服务器上。
          </li>
          <li>
            <strong>产品分析。</strong>本部署未配置分析项目，不会向 PostHog 发送任何产品事件或错误报告。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          数据存储位置
        </h2>
        <p>
          你的 Spotify 访问令牌保存在浏览器的{" "}
          <code>localStorage</code> 中，并随每次 Spotify 请求一起发送。
          你主动开启后产生的听歌历史保存在服务端的 Cloudflare D1 中。用于同步的刷新令牌在写入 D1 前会以 AES-GCM 加密，其加密密钥是一个独立的 Cloudflare Worker 密钥。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">音乐发现</h2>
        <p>
          生成推荐结果时，Spotistats 会结合你已记录的历史，以及 Spotify 的收藏、推荐、是否已点赞歌曲的校验和音乐属性。任何音乐数据都不会发送给 AI 模型。推荐结果与歌单保存进度会暂存在此标签页的会话存储中，方便你重新连接或重试保存。生成新的推荐会覆盖这份草稿；退出登录、清除站点数据或关闭标签页都会将其清空。保存需要另行授权，且只有在你确认后，才会在你的 Spotify 账户中创建一个私密歌单。删除 Spotistats 的数据不会删除你已保存到 Spotify 的歌单。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          Cookie
        </h2>
        <p>
          Spotistats 不会设置任何追踪 Cookie。听歌统计的登录流程也无需 Cookie：其 OAuth state 是一个随重定向携带的短期签名值，并在 Spotify 将你跳转回来时校验。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          数据保留期限
        </h2>
        <p>
          听歌数据会一直保存，直到你将其删除。关闭同步后同步会暂停；若连续六个月未打开仪表盘，也会自动暂停。你可以在{" "}
          <a href="/account" class="font-bold underline">
            账户页面
          </a>
          删除所有已保存的听歌记录和令牌；删除会立即生效且不可恢复。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          第三方
        </h2>
        <ul class="list-disc space-y-2 pl-5">
          <li>
            <strong>Spotify</strong> 通过其 Web API 提供账户与音乐数据。
          </li>
          <li>
            <strong>Cloudflare</strong> 托管本站，并在 D1 中保存经用户同意收集的听歌历史，同步由队列和定时任务完成。
          </li>
          <li>
            本部署未配置 PostHog。如果实例维护者日后提供 PostHog 项目密钥，产品事件和错误报告将通过第一方代理发送到该项目。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          你的管理选项
        </h2>
        <p>
          你可以将 Spotistats 为你的账户保存的全部数据导出为 JSON 或 CSV，可以停止同步，也可以删除所有已保存的数据。这三项操作都在账户页面完成，均无需联系我们。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          联系我们
        </h2>
        <p>
          对本政策有疑问，或需要提交数据相关请求？欢迎在{" "}
          <a
            href="https://github.com/sweetcpt/spotistats/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            GitHub
          </a>
          上提交 issue。
        </p>
      </section>
    </LegalLayout>
  );
}
