import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Static export: `npm run build` writes plain HTML/CSS/JS to ./out, which any
// static host can serve (GitHub Pages today). The live room server for online
// mode will be a separate service the browser talks to.
//
// BASE_PATH is set by the GitHub Pages workflow to "/<repo-name>" because
// project sites are served from https://<user>.github.io/<repo-name>/.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
  // Sent with every analytics event as app_version.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default nextConfig;
