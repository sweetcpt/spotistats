import { createSignal, onCleanup, onSettled } from "solid-js";

import { captureError } from "~/client/analytics";
import { errorMessage } from "~/lib/errors";

export function AppError(props: { error?: unknown; reset?: () => void }) {
  const [copied, setCopied] = createSignal(false);
  let copiedTimer: number | undefined;
  onCleanup(() => {
    if (copiedTimer !== undefined) window.clearTimeout(copiedTimer);
  });
  // The boundary handles this error, so PostHog's global handlers miss it.
  onSettled(() => {
    if (props.error !== undefined) captureError(props.error);
  });
  const errorText = () => {
    if (props.error instanceof Error) {
      return `${props.error.message}\n\n${props.error.stack ?? ""}`;
    }
    return errorMessage(props.error);
  };

  return (
    <main class="p-8 md:p-16 max-w-3xl">
      <div class="text-xs uppercase tracking-[0.2em] mb-3 text-[#5c5c5c]">
        系统错误
      </div>
      <p class="text-sm mb-6 text-[#555]">
        试试{" "}
        <a class="font-bold hover:underline" href="/login">
          重新登录
        </a>{" "}
        或{" "}
        <a
          class="font-bold hover:underline"
          target="_blank"
          rel="noopener"
          href="https://github.com/oscartbeaumont/spotistats/issues/new"
        >
          反馈这个问题
        </a>
        。请附上以下详情。
      </p>
      <pre class="overflow-auto p-4 text-xs border-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#f0ede8]">
        <samp>{errorText()}</samp>
      </pre>
      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => (props.reset ? props.reset() : window.location.reload())}
          class="border-4 border-[#0a0a0a] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
        >
          重试
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(errorText());
              setCopied(true);
              copiedTimer = window.setTimeout(() => setCopied(false), 1500);
            } catch (error) {
              console.error("Failed to copy error", error);
            }
          }}
          class="border-4 border-[#0a0a0a] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] hover:bg-[#0a0a0a] hover:text-[#f0ede8]"
        >
          {copied() ? "已复制" : "复制错误信息"}
        </button>
      </div>
    </main>
  );
}
