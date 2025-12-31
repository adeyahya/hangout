import { env } from "@/lib/env";
import { runFork, runPromise } from "@/lib/runtime";

import routes from "./routes";
import { serve } from "bun";
import * as E from "effect/Effect";
import { websocket } from "hono/bun";

const htmlFile = Bun.file("./dist/index.html");

const program = E.gen(function* () {
  const apiRoutes = yield* routes;
  serve({
    routes: {
      "/api/*": apiRoutes.fetch,
      "/*": async (req) =>
        runPromise(
          E.gen(function* () {
            const url = new URL(req.url);
            const path = url.pathname;

            const distFile = Bun.file(`./dist${path}`);
            const publicFile = Bun.file(`./public${path}`);

            const isDistFileExist = yield* E.tryPromise(() => distFile.exists());
            if (isDistFileExist) {
              return new Response(distFile, {
                headers: {
                  "Cache-Control": "public, max-age=31536000",
                },
              });
            }

            const isPublicHtmlExist = yield* E.tryPromise(() => publicFile.exists());
            if (isPublicHtmlExist) {
              return new Response(publicFile, {
                headers: {
                  "Cache-Control": "public, max-age=31536000",
                },
              });
            }
            const isHtmlFileExist = yield* E.tryPromise(() => htmlFile.exists());
            if (isHtmlFileExist) return new Response(htmlFile);

            return new Response("");
          }),
        ),
    },
    websocket,
    port: env.PORT,
  });

  yield* E.logInfo(`listening at http://localhost:${env.PORT}`);
});

runFork(program);
