import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).optional(),
  PORT: z.coerce.string().default("3000"),
});

export const env = envSchema.parse(process.env);
