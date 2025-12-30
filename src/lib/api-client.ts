import type { AppType } from "@/server/routes";

import { hc } from "hono/client";

export const apiClient = hc<AppType>("/", {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init);
    if (res.status >= 400) throw await res.json();
    return res;
  },
});
