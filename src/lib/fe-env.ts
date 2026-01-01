import { z } from "zod";

const envSchema = z.object({
  VITE_WS_ENDPOINT: z.string().default(import.meta.env.DEV ? "ws://localhost:3001" : ""),
});

export const feEnv = envSchema.parse(import.meta.env);
