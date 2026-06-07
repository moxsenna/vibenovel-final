import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { registerRoutes } from "./routes/index.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("*", corsMiddleware);
registerRoutes(app);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;