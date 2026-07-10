// Bundle the backend with Nest's webpack builder, inlining the workspace
// packages (@k2u/core, @k2u/shared-contracts) so the runtime image has no
// dependency on their TypeScript sources. All other node_modules stay external.
const nodeExternals = require("webpack-node-externals");

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      // Bundle @k2u/* into the output; keep everything else external.
      allowlist: [/^@k2u\//],
    }),
  ],
  resolve: {
    ...options.resolve,
    // Resolve the workspace TS sources (matches backend tsconfig paths).
    extensions: [".ts", ".js", ".json"],
    // NodeNext-style imports use explicit ".js" extensions that actually point
    // at ".ts" sources — let webpack/ts-loader resolve them.
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
