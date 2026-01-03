import * as E from "effect/Effect";
import * as S from "effect/Schema";

export const Ice = S.Struct({
  type: S.Literal("ice"),
  candidate: S.Any,
});
export type Ice = S.Schema.Type<typeof Ice>;

export const Sdp = S.Struct({
  type: S.Literal("sdp"),
  description: S.Any,
});
export type Sdp = S.Schema.Type<typeof Sdp>;

export const PeerJoin = S.Struct({
  type: S.Literal("peer-join"),
  room: S.String,
});
export type PeerJoin = S.Schema.Type<typeof PeerJoin>;

export const PeerLeft = S.Struct({
  type: S.Literal("peer-left"),
  room: S.String,
});
export type PeerLeft = S.Schema.Type<typeof PeerLeft>;

export const RawMessage = S.Struct({
  type: S.Literal("raw-message"),
  message: S.String,
});
export type RawMessage = S.Schema.Type<typeof RawMessage>;

export const MessageSchema = S.Union(Sdp, Ice, PeerJoin, PeerLeft);

export const encoder = S.encode(MessageSchema);
export const decoder = S.decode(MessageSchema);
export const stringDecoder = (json: string) =>
  E.try(() => JSON.parse(json)).pipe(E.flatMap((val) => decoder(val)));
