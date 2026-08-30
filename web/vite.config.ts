import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  server: {
    watch: { ignored: ["**/.wrangler/**"] },
  },
  plugins: [
    vinext({ cache: { cdn: cdnAdapter() } }),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
