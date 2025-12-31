import { api as IceApi } from "@/server/domain/ice/api";

import * as E from "effect/Effect";
import { Hono } from "hono";

const app = E.gen(function* () {
  const iceApi = yield* IceApi;
  return new Hono().route("/api/ice", iceApi);
});

export type EffectSuccess<T> = T extends E.Effect<infer A, never, never> ? A : never;

export type AppType = EffectSuccess<typeof app>;

export default app;
