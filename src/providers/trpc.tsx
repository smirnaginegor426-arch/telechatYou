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
        const entries = Array.isArray(payload) ? payload : [payload];
        const isTrpcEnvelope = entries.length > 0 && entries.every((entry) =>
          entry !== null &&
          typeof entry === "object" &&
          ("result" in entry || "error" in entry),
        );
        if (!isTrpcEnvelope) {
          const payloadRecord = payload && typeof payload === "object" && !Array.isArray(payload)
            ? payload as Record<string, unknown>
            : undefined;
          const errorValue = payloadRecord?.error;
          const errorRecord = errorValue && typeof errorValue === "object"
            ? errorValue as Record<string, unknown>
            : undefined;
          const detail = typeof errorRecord?.message === "string"
            ? errorRecord.message
            : typeof payloadRecord?.message === "string"
              ? payloadRecord.message
              : undefined;
          console.error("[tRPC transport] Unexpected JSON envelope", {
            path: requestPath,
            status: response.status,
            detail,
          });
          throw new Error(
            `API вернул JSON не в формате tRPC (HTTP ${response.status})${detail ? `: ${detail}` : ". Проверь адрес API и логи Render."}`,
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
