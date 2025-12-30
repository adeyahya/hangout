import { env } from "@/lib/env";

import routes from "./routes";
import { serve } from "bun";
import { websocket } from "hono/bun";

const htmlFile = Bun.file("./dist/index.html");

serve({
  routes: {
    "/api/*": routes.fetch,
    "/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;

      const distFile = Bun.file(`./dist${path}`);
      const publicFile = Bun.file(`./public${path}`);

      if (await distFile.exists()) {
        return new Response(distFile, {
          headers: {
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }

      if (await publicFile.exists()) {
        return new Response(publicFile, {
          headers: {
            "Cache-Control": "public, max-age=31536000",
          },
        });
      }
      if (await htmlFile.exists()) return new Response(htmlFile);

      return new Response("");
    },
  },
  websocket,
  port: env.PORT,
});

console.log(`listening at http://localhost:${env.PORT}`);
