import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        const requestUrl = input instanceof Request ? input.url : String(input);
        let requestPath = requestUrl.split("?")[0] ?? "/api/trpc";
        try {
          requestPath = new URL(requestUrl, globalThis.location.origin).pathname;
        } catch {
          // Keep the query-free fallback path for malformed relative URLs.
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          console.error("[tRPC transport] API returned non-JSON", {
            path: requestPath,
            status: response.status,
            contentType: contentType || "(missing)",
          });
          throw new Error(
            `API вернул не JSON (HTTP ${response.status}, ${contentType || "без Content-Type"}). Проверь маршрут /api/trpc и логи Render.`,
          );
        }

        const payload: unknown = await response.clone().json().catch(() => null);
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          value !== null && typeof value === "object" && !Array.isArray(value);
        const entries = Array.isArray(payload) ? payload : [payload];
        // Do not accept any arbitrary { error: ... } JSON as a tRPC response.
        // CSRF middleware, a reverse proxy, or an upstream error page can otherwise
        // pass this loose check and be misreported by tRPC as "Unable to transform...".
        const isTrpcEnvelope = entries.length > 0 && entries.every((entry) => {
          if (!isRecord(entry)) return false;
          const result = entry.result;
          if (isRecord(result) && "data" in result) return true;
          const error = entry.error;
          if (!isRecord(error)) return false;
          const errorPayload = isRecord(error.json) ? error.json : error;
          return typeof errorPayload.code === "number" && typeof errorPayload.message === "string";
        });
        if (!isTrpcEnvelope) {
          const firstEntry: unknown = Array.isArray(payload) ? payload[0] : payload;
          const payloadRecord = isRecord(firstEntry) ? firstEntry : undefined;
          const errorValue = payloadRecord?.error;
          const errorRecord = isRecord(errorValue) ? errorValue : undefined;
          const nestedError = errorRecord && isRecord(errorRecord.json) ? errorRecord.json : undefined;
          const detail = typeof errorValue === "string"
            ? errorValue
            : typeof errorRecord?.message === "string"
              ? errorRecord.message
              : typeof nestedError?.message === "string"
                ? nestedError.message
                : typeof payloadRecord?.message === "string"
                  ? payloadRecord.message
                  : undefined;
          const responsePreview = JSON.stringify(firstEntry)?.slice(0, 500) ?? "(не удалось прочитать тело ответа)";
          console.error("[tRPC transport] Unexpected JSON response", {
            path: requestPath,
            status: response.status,
            detail,
            responsePreview,
          });
          throw new Error(
            `API вернул ответ не в формате tRPC (HTTP ${response.status})${detail ? `: ${detail}` : `. Ответ: ${responsePreview}`}`,
          );
        }
        return response;
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
