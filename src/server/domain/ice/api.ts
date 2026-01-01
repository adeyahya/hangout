import { runPromise } from "@/lib/runtime";
import * as IceSchema from "@/schema/ice-schema";

import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext, WSEvents } from "hono/ws";

export const api = E.gen(function* () {
  const stateRef = yield* Ref.make<{ connection: Map<unknown, WSContext<unknown>> }>({
    connection: new Map(),
  });

  const router = new Hono().get(
    "/",
    upgradeWebSocket(() =>
      runPromise(
        E.gen(function* (_) {
          yield* E.logInfo("connection upgraded");

          return {
            onOpen: (_event, ctx) =>
              _(
                E.gen(function* () {
                  yield* E.logInfo("connection established");

                  yield* Ref.update(stateRef, (prev) => {
                    const connection = new Map(prev.connection);
                    connection.set(ctx.raw, ctx);
                    return { ...prev, connection };
                  });

                  const { connection } = yield* stateRef.get;
                  const payload = yield* IceSchema.encoder({ type: "peer-join", room: "default" });
                  yield* E.forEach(connection, ([raw, conCtx]) =>
                    E.try(() => {
                      if (raw !== ctx.raw) conCtx.send(JSON.stringify(payload));
                    }),
                  );
                }),
              ).pipe(E.runFork),
            onMessage: (event, ctx) =>
              _(
                E.gen(function* () {
                  const { connection } = yield* stateRef.get;
                  // relay
                  yield* E.forEach(connection, ([raw, conCtx]) =>
                    E.try(() => {
                      if (raw !== ctx.raw) conCtx.send(event.data as ArrayBuffer);
                    }),
                  );
                }),
              ).pipe(E.runFork),
            onClose: (_event, ctx) =>
              _(
                E.gen(function* () {
                  yield* Ref.update(stateRef, (prev) => {
                    const connection = new Map(prev.connection);
                    connection.delete(ctx.raw);
                    return { ...prev, connection };
                  });
                }),
              ).pipe(E.runFork),
          } satisfies WSEvents;
        }),
      ),
    ),
  );

  return router;
});
