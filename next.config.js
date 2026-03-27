/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
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
