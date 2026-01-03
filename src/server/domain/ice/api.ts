import { runPromise } from "@/lib/runtime";
import * as IceSchema from "@/schema/ice-schema";

import { HashMap } from "effect";
import * as E from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext, WSEvents } from "hono/ws";

export const api = E.gen(function* () {
  const mutexRef = yield* Ref.make(HashMap.empty<unknown, E.Semaphore>());
  const connectionRef = yield* Ref.make(HashMap.empty<unknown, WSContext<unknown>>());
  const pairsRef = yield* Ref.make(HashMap.empty<unknown, unknown>());

  const assignMutex = (raw: unknown) =>
    E.gen(function* () {
      const mutex = yield* E.makeSemaphore(1);
      yield* Ref.update(mutexRef, HashMap.set(raw, mutex));
      return mutex;
    });

  const getMutex = (raw: unknown) =>
    mutexRef.get.pipe(E.map(HashMap.get(raw))).pipe(
      E.flatMap(
        O.match({
          onNone: () => assignMutex(raw),
          onSome: E.succeed,
        }),
      ),
    );

  const assignPair = (raw: unknown) => (a: E.Effect<unknown>) =>
    E.gen(function* () {
      const pair = yield* a;
      yield* Ref.update(pairsRef, HashMap.set(raw, pair));
      yield* Ref.update(pairsRef, HashMap.set(pair, raw));
      return yield* a;
    });

  const getPair = (caller: unknown, skip?: unknown) =>
    E.gen(function* () {
      const pairs = yield* pairsRef.get;
      return yield* pairs.pipe(HashMap.get(caller)).pipe(
        O.match({
          onNone: () => findPair(caller, skip).pipe(assignPair(caller)),
          onSome: E.succeed,
        }),
      );
    });

  const disconnectHandler = (raw: unknown) =>
    E.gen(function* () {
      yield* Ref.update(connectionRef, HashMap.remove(raw));
      const pair = yield* getPair(raw);
      yield* Ref.update(pairsRef, HashMap.remove(pair));
      yield* Ref.update(pairsRef, HashMap.remove(pair));
      const payload = yield* IceSchema.encoder({ type: "peer-left", room: "" }).pipe(
        E.flatMap((result) => E.try(() => JSON.stringify(result))),
      );
      yield* E.sleep("500 millis");
      yield* sendMessageToRaw(pair, payload);
    });

  const breakPair = (raw: unknown) =>
    E.gen(function* () {
      const pair = yield* getPair(raw);
      yield* Ref.update(pairsRef, HashMap.remove(pair));
      yield* Ref.update(pairsRef, HashMap.remove(pair));
      const payload = yield* IceSchema.encoder({ type: "peer-left", room: "" }).pipe(
        E.flatMap((result) => E.try(() => JSON.stringify(result))),
      );
      yield* sendMessageToRaw(raw, payload);
      yield* E.sleep("200 millis");
      yield* sendMessageToRaw(pair, payload);
    });

  const findPair = (caller: unknown, skip?: unknown) =>
    E.gen(function* () {
      const pairs = yield* pairsRef;
      const connection = yield* connectionRef;
      const currentPair = HashMap.get(pairs, caller);
      if (O.isSome(currentPair)) return currentPair.value;

      const maybeCandidate = connection.pipe(
        HashMap.findFirst((_ctx, raw) => {
          if (raw === caller) return false;
          if (raw === skip) return false;
          if (pairs.pipe(HashMap.has(raw))) return false;
          return true;
        }),
      );

      if (O.isSome(maybeCandidate)) return maybeCandidate.value[0];
    })
      .pipe(E.delay("500 millis"))
      .pipe(E.repeat({ until: (val) => !!val }));

  const sendMessageToRaw = (raw: unknown, message: unknown) =>
    E.gen(function* () {
      const ctx = yield* connectionRef.get.pipe(E.map(HashMap.get(raw)));
      if (O.isSome(ctx)) yield* E.try(() => ctx.value.send(message as ArrayBuffer));
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
                  const mutex = yield* getMutex(ctx.raw);

                  const sendJoinMessage = (pair: unknown) =>
                    IceSchema.encoder({ type: "peer-join", room: "" })
                      .pipe(E.flatMap((payload) => E.try(() => JSON.stringify(payload))))
                      .pipe(E.flatMap((payload) => sendMessageToRaw(pair, payload)));

                  yield* Ref.update(connectionRef, HashMap.set(ctx.raw, ctx))
                    .pipe(E.flatMap(() => getPair(ctx.raw)))
                    .pipe(E.flatMap(sendJoinMessage))
                    .pipe(mutex.withPermits(1));
                }),
              ).pipe(E.runFork),
            onMessage: (event, ctx) =>
              _(
                E.gen(function* () {
                  const mutex = yield* getMutex(ctx.raw);

                  if (event.data === "ping") {
                    return ctx.send("pong");
                  }

                  if (event.data === "left") {
                    return yield* breakPair(ctx.raw).pipe(mutex.withPermits(1));
                  }

                  yield* getPair(ctx.raw)
                    .pipe(E.flatMap((pair) => sendMessageToRaw(pair, event.data)))
                    .pipe(mutex.withPermits(1));
                }),
              ).pipe(E.runFork),
            onClose: (_event, ctx) =>
              _(
                E.gen(function* () {
                  const mutex = yield* getMutex(ctx.raw);
                  yield* disconnectHandler(ctx.raw).pipe(mutex.withPermits(1));
                }),
              ).pipe(E.runFork),
          } satisfies WSEvents;
        }),
      ),
    ),
  );

  return router;
});
