import { createApp } from "./app.js";
const app = await createApp();
await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
