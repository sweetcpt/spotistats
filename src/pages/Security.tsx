import { LegalLayout } from "~/components/LegalLayout";

/**
 * The security policy.
 *
 * The machine-readable summary is served from `/.well-known/security.txt`,
 * which points back at this page.
 */
export default function SecurityPage() {
  return (
    <LegalLayout title="安全政策" updated="2026 年 10 月 22 日">
      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          报告安全漏洞
        </h2>
        <p>
          请通过{" "}
          <a
            href="https://github.com/sweetcpt/spotistats/security/advisories/new"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline"
          >
            GitHub 私密安全公告
          </a>
          私下报告安全问题。疑似漏洞请勿公开提交 issue。
        </p>
        <p class="mt-3">
          请提供足以复现问题的细节：相关 URL、操作步骤，以及你预期发生的结果。我们会确认收到报告，并在调查过程中持续向你同步进展。
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          适用范围
        </h2>
        <p>以下情况在适用范围内：</p>
        <ul class="mt-2 list-disc space-y-2 pl-5">
          <li>
            本 Spotistats 部署实例及其 API。
          </li>
          <li>本仓库中的源代码，包括 worker。</li>
          <li>
            身份验证与会话处理，包括听歌统计的 OAuth 流程。
          </li>
          <li>
            访问其他用户已保存的听歌历史或令牌。
          </li>
        </ul>
        <p class="mt-3">以下情况不在适用范围内：</p>
        <ul class="mt-2 list-disc space-y-2 pl-5">
          <li>Spotify 自有的服务与 API。</li>
          <li>
            针对托管站点的拒绝服务攻击、垃圾信息或自动化流量。
          </li>
          <li>
            自动化扫描器提交的、不含具体可利用发现的报告。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          请勿进行以下操作
        </h2>
        <ul class="list-disc space-y-2 pl-5">
          <li>访问、修改或删除不属于你的数据。</li>
          <li>对托管服务进行破坏性测试。</li>
          <li>
            使用社会工程手段，或针对他人的 Spotify 账户。
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          机器可读的政策文件
        </h2>
        <p>
          标准的安全联系文件位于{" "}
          <a href="/.well-known/security.txt" class="font-bold underline">
            /.well-known/security.txt
          </a>
          。
        </p>
      </section>
    </LegalLayout>
  );
}
