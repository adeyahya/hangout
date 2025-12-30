import * as E from "effect/Effect";

export const make = () =>
  E.tryPromise(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return stream;
  });
