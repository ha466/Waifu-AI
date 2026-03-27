import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  compress: true,
  experimental: {
    optimizePackageImports: ["react-icons"],
    swcMinify: true,
    serverComponentsExternalPackages: ["onnxruntime-web", "@huggingface/transformers"],
  },
  webpack: (config, { isServer }) => {
    // Disable resolving symlinks to their absolute paths to prevent pnpm mapping crashes
    config.resolve.symlinks = false;

    // Define ~ alias for webpack if not handled by Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
      "~": path.resolve(__dirname, "src"),
    };

    // Exclude onnxruntime-node from client bundles (we only need onnxruntime-web)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
        sharp: false,
      };
    }
    // Ignore .node native binary files
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
      type: "javascript/auto",
    });
    return config;
  },
};

export default config;
