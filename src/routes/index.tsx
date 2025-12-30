import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";

import * as MS from "@/lib/media-stream";

import * as E from "effect/Effect";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    MS.make()
      .pipe(E.tap((stream) => (videoRef.current!.srcObject = stream)))
      .pipe(E.runFork);
  }, []);

  return (
    <div>
      <video style={{ width: 400, height: 400 }} autoPlay ref={videoRef} />
    </div>
  );
}
