#!/usr/bin/env bun
import tailwind from "bun-plugin-tailwind";

const result = await Bun.build({
  entrypoints: ["src/server/index.ts"],
  target: "bun",
  minify: true,
  plugins: [tailwind],
  compile: {
    outfile: "dist/app",
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
