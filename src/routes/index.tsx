import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import * as MS from "@/lib/media-stream";
import * as WebRTC from "@/lib/webrtc";

import { Fiber } from "effect";
import * as E from "effect/Effect";
import * as O from "effect/Option";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [remote, setRemote] = useState<MediaStream>();

  useEffect(() => {
    const updateState = (rtc: WebRTC.WebRTC) =>
      E.gen(function* () {
        yield* E.sync(() => O.isSome(rtc.remote) && setRemote(rtc.remote.value));
      }).pipe(E.delay("200 millis"), E.repeat({ until: () => false }));

    const fork = MS.make()
      .pipe(E.tap((stream) => (videoRef.current!.srcObject = stream)))
      .pipe(E.flatMap((stream) => WebRTC.make({ localStream: stream, iceServers: [] })))
      .pipe(E.flatMap(updateState))
      .pipe(E.runFork);

    return () => {
      Fiber.interrupt(fork).pipe(E.runFork);
    };
  }, []);

  return (
    <div>
      <video style={{ width: 400, height: 400 }} controls={false} muted autoPlay ref={videoRef} />
      {remote && <Vid stream={remote} />}
    </div>
  );
}

const Vid = (props: { stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.srcObject = props.stream;
  }, [props.stream]);

  return <video style={{ width: 400, height: 400 }} controls={false} autoPlay ref={videoRef} />;
};
