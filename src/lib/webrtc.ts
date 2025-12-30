import { Ref } from "effect";
import type { UnknownException } from "effect/Cause";
import * as E from "effect/Effect";

export interface WebRTC {
  peer: RTCPeerConnection;
  local: MediaStream;
  remote: MediaStream;
  state: Ref.Ref<{ makingOffer: boolean }>;
  dispose: E.Effect<void, UnknownException>;
}

export const make = (params: { localStream: MediaStream; iceServers: RTCIceServer[] }) =>
  E.gen(function* () {
    const peerConnection = new RTCPeerConnection({ iceServers: params.iceServers });
    const remoteStream = yield* E.try(() => new MediaStream());
    const state = yield* Ref.make({ makingOffer: false });
    const RTC: WebRTC = {
      peer: peerConnection,
      remote: remoteStream,
      local: params.localStream,
      state,
      dispose: E.void,
    };

    // transmit local tracks to peer
    yield* E.forEach(params.localStream.getTracks(), (track) =>
      E.try(() => peerConnection.addTrack(track, params.localStream)),
    );

    // handle ice candidate
    peerConnection.onicecandidate = handleIceEvent(RTC);
    // receive track from peers
    peerConnection.ontrack = handleTrack(RTC);
    // handle negotiation
    peerConnection.onnegotiationneeded = handleNegotiation(RTC);

    // dispose function
    RTC.dispose = E.try(() => {});

    return RTC;
  });

const handleNegotiation = (rtc: WebRTC) => () =>
  E.gen(function* () {
    yield* Ref.update(rtc.state, (value) => ({ ...value, makingOffer: true }));
    const description = yield* E.tryPromise(() => rtc.peer.createOffer());
    yield* E.tryPromise(() => rtc.peer.setLocalDescription(description));
  })
    .pipe(E.ensuring(Ref.update(rtc.state, (value) => ({ ...value, makingOffer: false }))))
    .pipe(E.runFork);

const handleTrack = (rtc: WebRTC) => (event: RTCTrackEvent) =>
  E.try(() => {
    rtc.remote.addTrack(event.track);
  }).pipe(E.runFork);

const handleIceEvent = (rtc: WebRTC) => (event: RTCPeerConnectionIceEvent) =>
  E.try(() => {
    if (event.candidate) {
      // sending to ws
      console.log(event.candidate);
    }
  }).pipe(E.runFork);
