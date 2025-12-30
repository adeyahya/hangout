import { Hono } from "hono";

const app = new Hono().get("/api/hello", (c) => c.json({ message: "it works" }));

export type AppType = typeof app;

export default app;
