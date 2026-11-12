import type { NextConfig } from "next"

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["pg"],
  // Docker deployment: emit a self-contained server bundle that the runner
  // image can start with `node server.js` without node_modules.
  output: "standalone"
}

export default config
