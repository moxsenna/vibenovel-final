import ws from "ws";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getNodePort, loadBindingsFromProcessEnv } from "./node-bindings.js";

// Supabase client may touch Realtime; Node.js < 22 has no native WebSocket.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = ws as unknown as typeof WebSocket;
}

const bindings = loadBindingsFromProcessEnv();
const app = createApp();
const port = getNodePort();

serve(
  {
    fetch: (request) => app.fetch(request, bindings),
    port,
  },
  (info) => {
    console.log(
      `VibeNovel API (Node) listening on http://localhost:${info.port} appEnv=${bindings.APP_ENV ?? "development"}`,
    );
  },
);