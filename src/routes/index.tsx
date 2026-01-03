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
  const rtcRef = useRef<WebRTC.WebRTC>();
  const [remote, setRemote] = useState<MediaStream>();

  const createRTC = () => {
    const updateState = (rtc: WebRTC.WebRTC) =>
      E.gen(function* () {
        rtcRef.current = rtc;
        yield* E.sync(() => {
          if (O.isSome(rtc.remote)) {
            setRemote(rtc.remote.value);
          } else {
            setRemote(undefined);
          }
        });
      }).pipe(E.delay("200 millis"), E.repeat({ until: () => false }));

    return MS.make()
      .pipe(E.tap((stream) => (videoRef.current!.srcObject = stream)))
      .pipe(E.flatMap((stream) => WebRTC.make({ localStream: stream, iceServers: [] })))
      .pipe(E.flatMap(updateState))
      .pipe(E.catchAllCause(E.logError))
      .pipe(E.runFork);
  };

  const handleNext = () => {
    if (!remote) return;
    window.location.reload();
  };

  useEffect(() => {
    const fork = createRTC();
    return () => {
      Fiber.interrupt(fork).pipe(E.runFork);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="flex-1 flex flex-col lg:flex-row bg-black">
        <div className="flex-1">{remote && <Vid stream={remote} />}</div>
        <div className="flex-1">
          <video
            className="w-full h-full object-contain -scale-x-100"
            controls={false}
            muted
            autoPlay
            ref={videoRef}
          />
        </div>
      </div>
      <div className="h-[100px] lg:h-[200px] flex items-center justify-center">
        <button
          disabled={!remote}
          className="bg-blue-500 active:bg-blue-600 disabled:bg-gray-200 text-4xl p-4 px-8 text-white rounded-lg"
          onClick={handleNext}
        >
          Sekiiiiiiiip
        </button>
      </div>
    </div>
  );
}

const Vid = (props: { stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.srcObject = props.stream;
  }, [props.stream]);

  return (
    <video
      className="w-full h-full object-contain -scale-x-100"
      controls={false}
      autoPlay
      ref={videoRef}
    />
  );
};
