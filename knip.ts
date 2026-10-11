// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 The Fisher Slopworks Co

import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    // The SPA is reached through a Bun HTML import
    // (`server/index.ts` → `frontend/index.html` → `<script src=…>`). Knip does
    // not follow the HTML hop, so the React root is named directly.
    "src/frontend/frontend.tsx",
    "scripts/*.ts",
    "build-server.ts",
    // Co-located tests are roots of their own: an export that only a test
    // reaches is still reached.
    "src/**/*.test.{ts,tsx}",
  ],
  project: ["src/**/*.{ts,tsx,css}", "scripts/**/*.ts", "*.ts"],
  // shadcn/ui components are copied from its registry as a set (and licensed
  // separately, see REUSE.toml); unused ones stay available rather than being
  // deleted and re-fetched.
  ignore: ["src/frontend/components/ui/**"],
  ignoreDependencies: [
    // Consumed by Bun from `bunfig.toml`'s `[serve.static]` plugin list, which
    // knip has no reason to read.
    "bun-plugin-tailwind",
    // Pulled in by `@import` in `styles/globals.css`, which knip does not parse.
    "tailwindcss",
    "tw-animate-css",
    "@fontsource/jetbrains-mono",
    // Only used by the shadcn/ui components ignored above.
    "@radix-ui/react-label",
    "@radix-ui/react-select",
  ],
  // `uv` is a machine prerequisite, not an npm package.
  ignoreBinaries: ["uvx"],
};

export default config;
