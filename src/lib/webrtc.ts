import * as IceSchema from "@/schema/ice-schema";

import { Ref } from "effect";
import type { UnknownException } from "effect/Cause";
import * as E from "effect/Effect";
import * as M from "effect/Match";
import * as O from "effect/Option";

export interface WebRTC {
  peer: O.Option<RTCPeerConnection>;
  iceServers: Array<RTCIceServer>;
  local: MediaStream;
  remote: O.Option<MediaStream>;
  state: Ref.Ref<{ makingOffer: boolean }>;
  wsConnectionStatus: "connecting" | "connected" | "disconnected";
  ws: WebSocket;
  dispose: E.Effect<void, UnknownException>;
}

export const make = (params: { localStream: MediaStream; iceServers: RTCIceServer[] }) =>
  E.gen(function* () {
    const state = yield* Ref.make({ makingOffer: false });
    const RTC: WebRTC = {
      peer: O.none(),
      iceServers: params.iceServers,
      remote: O.none(),
      local: params.localStream,
      wsConnectionStatus: "connecting",
      ws: new WebSocket("ws://localhost:3001/api/ice"),
      state,
      dispose: E.void,
    };

    const initializeWs = async () => {
      if (RTC.wsConnectionStatus === "disconnected") {
        await E.runPromise(E.sleep("100 millis"));
        RTC.ws = new WebSocket("ws://localhost:3001/api/ice");
      }

      RTC.ws.onopen = () => {
        RTC.wsConnectionStatus = "connected";
      };

      RTC.ws.onclose = () => {
        RTC.wsConnectionStatus = "disconnected";
        initializeWs();
      };

      RTC.ws.onmessage = (event) =>
        E.gen(function* () {
          const decoded = yield* IceSchema.stringDecoder(String(event.data)).pipe(
            E.catchAllCause(() => E.void),
          );
          yield* M.value(decoded)
            .pipe(M.when({ type: "ice" }, (message) => iceHandler(RTC, message)))
            .pipe(M.when({ type: "peer-join" }, () => createPeer(RTC)))
            .pipe(M.when({ type: "sdp" }, (message) => sdpHandler(RTC, message)))
            .pipe(M.orElse(() => E.void));
        }).pipe(E.runFork);
    };

    initializeWs();

    // dispose function
    RTC.dispose = E.try(() => {});

    return RTC;
  });

const getPeer = (rtc: WebRTC) =>
  E.gen(function* () {
    if (O.isSome(rtc.peer)) return rtc.peer.value;

    return yield* createPeer(rtc);
  });

const iceHandler = (rtc: WebRTC, message: IceSchema.Ice) =>
  E.gen(function* () {
    const peer = yield* getPeer(rtc);
    yield* E.tryPromise(() => peer.addIceCandidate(message.candidate));
  });

const sdpHandler = (rtc: WebRTC, message: IceSchema.Sdp) =>
  E.gen(function* () {
    const peer = yield* getPeer(rtc);
    const state = yield* rtc.state.get;
    const description = message.description as RTCSessionDescriptionInit;
    const offerCollision =
      description.type === "offer" && (state.makingOffer || peer.signalingState !== "stable");
    if (offerCollision) {
      yield* E.logWarning("Offer collision: ignoring offer (simple policy)");
      return;
    }

    yield* E.tryPromise(() => peer.setRemoteDescription(description));
    if (description.type === "offer") {
      const answer = yield* E.tryPromise(() => peer.createAnswer());
      yield* E.tryPromise(() => peer.setLocalDescription(answer));
      const payload = yield* IceSchema.encoder({
        type: "sdp",
        description: peer.localDescription,
      });
      yield* E.try(() => rtc.ws.send(JSON.stringify(payload)));
    }
  }).pipe(E.catchAllCause(E.logError));

const createPeer = (rtc: WebRTC) =>
  E.gen(function* () {
    const peer = new RTCPeerConnection({ iceServers: rtc.iceServers });
    rtc.peer = O.some(peer);
    const remoteStream = yield* E.try(() => new MediaStream());
    rtc.remote = O.some(remoteStream);

    // transmit local tracks to peer
    yield* E.forEach(
      rtc.local.getTracks(),
      (track) => E.try(() => peer.addTrack(track, rtc.local)),
      { batching: false },
    );

    // handle ice candidate
    peer.onicecandidate = handleIceEvent(rtc);
    // receive track from peers
    peer.ontrack = handleTrack(rtc, remoteStream);
    // handle negotiation
    peer.onnegotiationneeded = handleNegotiation(rtc, peer);

    return peer;
  });

const handleNegotiation = (rtc: WebRTC, peer: RTCPeerConnection) => () =>
  E.gen(function* () {
    yield* Ref.update(rtc.state, (value) => ({ ...value, makingOffer: true }));
    const description = yield* E.tryPromise(() => peer.createOffer());
    yield* E.tryPromise(() => peer.setLocalDescription(description));
    const payload = yield* IceSchema.encoder({ type: "sdp", description });
    yield* E.try(() => rtc.ws.send(JSON.stringify(payload)));
  })
    .pipe(E.ensuring(Ref.update(rtc.state, (value) => ({ ...value, makingOffer: false }))))
    .pipe(E.runFork);

const handleTrack = (_rtc: WebRTC, remote: MediaStream) => (event: RTCTrackEvent) =>
  E.try(() => {
    console.log("got event", event.track);
    remote.addTrack(event.track);
  }).pipe(E.runFork);

const handleIceEvent = (rtc: WebRTC) => (event: RTCPeerConnectionIceEvent) =>
  E.gen(function* () {
    if (event.candidate) {
      const payload = yield* IceSchema.encoder({ type: "ice", candidate: event.candidate });
      yield* E.try(() => rtc.ws.send(JSON.stringify(payload)));
    }
  }).pipe(E.runFork);
