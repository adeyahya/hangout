import { Context, Effect, Layer, ManagedRuntime } from "effect";

class Dummy extends Context.Tag("Dummy")<Dummy, Effect.Effect<void>>() {
  static live() {
    return Layer.succeed(Dummy, Effect.void);
  }
}

const appLayer = Layer.mergeAll(Dummy.live());

// Create a custom runtime from the configuration layer
export const runtime = ManagedRuntime.make(appLayer);
export const runFork = runtime.runFork;
export const runPromise = runtime.runPromise;
