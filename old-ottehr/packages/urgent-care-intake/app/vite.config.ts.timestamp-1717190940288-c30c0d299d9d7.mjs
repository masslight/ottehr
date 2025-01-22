// vite.config.ts
import { sentryVitePlugin } from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/@sentry+vite-plugin@2.10.2/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import path2 from "path";
import { defineConfig as defineConfig2, loadEnv as loadEnv2, mergeConfig } from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/vite@4.5.1_@types+node@18.19.8/node_modules/vite/dist/node/index.js";

// ../../../vite.config.ts
import react from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/@vitejs+plugin-react@4.2.1_vite@4.5.1/node_modules/@vitejs/plugin-react/dist/index.mjs";
import browserslistToEsbuild from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/browserslist-to-esbuild@1.2.0/node_modules/browserslist-to-esbuild/src/index.js";
import * as path from "path";
import { defineConfig, loadEnv } from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/vite@4.5.1_@types+node@18.19.8/node_modules/vite/dist/node/index.js";
import svgr from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/vite-plugin-svgr@4.1.0_rollup@2.79.1_typescript@4.9.5_vite@4.5.1/node_modules/vite-plugin-svgr/dist/index.js";
import viteTsconfigPaths from "file:///Users/saewitz/Documents/zapehr/ottehr/node_modules/.pnpm/vite-tsconfig-paths@4.2.1_typescript@4.9.5_vite@4.5.1/node_modules/vite-tsconfig-paths/dist/index.mjs";
var vite_config_default = ({ mode }) => {
  const envDir = "./env";
  const env = loadEnv(mode, path.join(process.cwd(), envDir), "");
  return defineConfig({
    envDir,
    publicDir: "public",
    plugins: [react(), viteTsconfigPaths(), svgr()],
    server: {
      open: true,
      port: env.PORT ? parseInt(env.PORT) : void 0
    },
    optimizeDeps: {
      exclude: ["js-big-decimal"]
    },
    build: {
      outDir: "./build",
      target: browserslistToEsbuild()
    }
  });
};

// vite.config.ts
var vite_config_default2 = (env) => {
  const { mode } = env;
  const envDir = "./env";
  const appEnv = loadEnv2(mode, path2.join(process.cwd(), envDir), "");
  const shouldUploadSentrySourceMaps = mode === "staging";
  console.log(mode);
  return mergeConfig(
    vite_config_default({ mode }),
    defineConfig2({
      build: {
        sourcemap: mode === "default" || shouldUploadSentrySourceMaps
      },
      optimizeDeps: {
        exclude: ["js-big-decimal"]
      },
      plugins: [
        shouldUploadSentrySourceMaps ? sentryVitePlugin({
          authToken: appEnv.SENTRY_AUTH_TOKEN,
          org: "masslight-j2",
          project: "urgent-care-qrs",
          sourcemaps: {
            assets: ["./build/**/*"]
          }
        }) : null
      ]
    })
  );
};
export {
  vite_config_default2 as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAiLi4vLi4vLi4vdml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvc2Fld2l0ei9Eb2N1bWVudHMvemFwZWhyL290dGVoci9wYWNrYWdlcy91cmdlbnQtY2FyZS1pbnRha2UvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvc2Fld2l0ei9Eb2N1bWVudHMvemFwZWhyL290dGVoci9wYWNrYWdlcy91cmdlbnQtY2FyZS1pbnRha2UvYXBwL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9zYWV3aXR6L0RvY3VtZW50cy96YXBlaHIvb3R0ZWhyL3BhY2thZ2VzL3VyZ2VudC1jYXJlLWludGFrZS9hcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS92aXRlLXBsdWdpbic7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiwgbWVyZ2VDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi4vLi4vLi4vdml0ZS5jb25maWcnO1xuXG5leHBvcnQgZGVmYXVsdCAoZW52KSA9PiB7XG4gIGNvbnN0IHsgbW9kZSB9ID0gZW52O1xuICBjb25zdCBlbnZEaXIgPSAnLi9lbnYnO1xuICBjb25zdCBhcHBFbnYgPSBsb2FkRW52KG1vZGUsIHBhdGguam9pbihwcm9jZXNzLmN3ZCgpLCBlbnZEaXIpLCAnJyk7XG5cbiAgY29uc3Qgc2hvdWxkVXBsb2FkU2VudHJ5U291cmNlTWFwcyA9IG1vZGUgPT09ICdzdGFnaW5nJztcbiAgY29uc29sZS5sb2cobW9kZSk7XG5cbiAgcmV0dXJuIG1lcmdlQ29uZmlnKFxuICAgIGNvbmZpZyh7IG1vZGUgfSksXG4gICAgZGVmaW5lQ29uZmlnKHtcbiAgICAgIGJ1aWxkOiB7XG4gICAgICAgIHNvdXJjZW1hcDogbW9kZSA9PT0gJ2RlZmF1bHQnIHx8IHNob3VsZFVwbG9hZFNlbnRyeVNvdXJjZU1hcHMsXG4gICAgICB9LFxuICAgICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAgIGV4Y2x1ZGU6IFsnanMtYmlnLWRlY2ltYWwnXSxcbiAgICAgIH0sXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHNob3VsZFVwbG9hZFNlbnRyeVNvdXJjZU1hcHNcbiAgICAgICAgICA/IHNlbnRyeVZpdGVQbHVnaW4oe1xuICAgICAgICAgICAgICBhdXRoVG9rZW46IGFwcEVudi5TRU5UUllfQVVUSF9UT0tFTixcbiAgICAgICAgICAgICAgb3JnOiAnbWFzc2xpZ2h0LWoyJyxcbiAgICAgICAgICAgICAgcHJvamVjdDogJ3VyZ2VudC1jYXJlLXFycycsXG4gICAgICAgICAgICAgIHNvdXJjZW1hcHM6IHtcbiAgICAgICAgICAgICAgICBhc3NldHM6IFsnLi9idWlsZC8qKi8qJ10sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIDogbnVsbCxcbiAgICAgIF0sXG4gICAgfSksXG4gICk7XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvc2Fld2l0ei9Eb2N1bWVudHMvemFwZWhyL290dGVoclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3NhZXdpdHovRG9jdW1lbnRzL3phcGVoci9vdHRlaHIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3NhZXdpdHovRG9jdW1lbnRzL3phcGVoci9vdHRlaHIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IGJyb3dzZXJzbGlzdFRvRXNidWlsZCBmcm9tICdicm93c2Vyc2xpc3QtdG8tZXNidWlsZCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgc3ZnciBmcm9tICd2aXRlLXBsdWdpbi1zdmdyJztcbmltcG9ydCB2aXRlVHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcblxuZXhwb3J0IGRlZmF1bHQgKHsgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IGVudkRpciA9ICcuL2Vudic7XG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIGVudkRpciksICcnKTtcblxuICByZXR1cm4gZGVmaW5lQ29uZmlnKHtcbiAgICBlbnZEaXI6IGVudkRpcixcbiAgICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB2aXRlVHNjb25maWdQYXRocygpLCBzdmdyKCldLFxuICAgIHNlcnZlcjoge1xuICAgICAgb3BlbjogdHJ1ZSxcbiAgICAgIHBvcnQ6IGVudi5QT1JUID8gcGFyc2VJbnQoZW52LlBPUlQpIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICBleGNsdWRlOiBbJ2pzLWJpZy1kZWNpbWFsJ10sXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiAnLi9idWlsZCcsXG4gICAgICB0YXJnZXQ6IGJyb3dzZXJzbGlzdFRvRXNidWlsZCgpLFxuICAgIH0sXG4gIH0pO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1ksU0FBUyx3QkFBd0I7QUFDcmEsT0FBT0EsV0FBVTtBQUNqQixTQUFTLGdCQUFBQyxlQUFjLFdBQUFDLFVBQVMsbUJBQW1COzs7QUNGaVAsT0FBTyxXQUFXO0FBQ3RULE9BQU8sMkJBQTJCO0FBQ2xDLFlBQVksVUFBVTtBQUN0QixTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFVBQVU7QUFDakIsT0FBTyx1QkFBdUI7QUFFOUIsSUFBTyxzQkFBUSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQzNCLFFBQU0sU0FBUztBQUNmLFFBQU0sTUFBTSxRQUFRLE1BQVcsVUFBSyxRQUFRLElBQUksR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUU5RCxTQUFPLGFBQWE7QUFBQSxJQUNsQjtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsU0FBUyxDQUFDLE1BQU0sR0FBRyxrQkFBa0IsR0FBRyxLQUFLLENBQUM7QUFBQSxJQUM5QyxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNLElBQUksT0FBTyxTQUFTLElBQUksSUFBSSxJQUFJO0FBQUEsSUFDeEM7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaLFNBQVMsQ0FBQyxnQkFBZ0I7QUFBQSxJQUM1QjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsUUFBUSxzQkFBc0I7QUFBQSxJQUNoQztBQUFBLEVBQ0YsQ0FBQztBQUNIOzs7QUR0QkEsSUFBT0MsdUJBQVEsQ0FBQyxRQUFRO0FBQ3RCLFFBQU0sRUFBRSxLQUFLLElBQUk7QUFDakIsUUFBTSxTQUFTO0FBQ2YsUUFBTSxTQUFTQyxTQUFRLE1BQU1DLE1BQUssS0FBSyxRQUFRLElBQUksR0FBRyxNQUFNLEdBQUcsRUFBRTtBQUVqRSxRQUFNLCtCQUErQixTQUFTO0FBQzlDLFVBQVEsSUFBSSxJQUFJO0FBRWhCLFNBQU87QUFBQSxJQUNMLG9CQUFPLEVBQUUsS0FBSyxDQUFDO0FBQUEsSUFDZkMsY0FBYTtBQUFBLE1BQ1gsT0FBTztBQUFBLFFBQ0wsV0FBVyxTQUFTLGFBQWE7QUFBQSxNQUNuQztBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ1osU0FBUyxDQUFDLGdCQUFnQjtBQUFBLE1BQzVCO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUCwrQkFDSSxpQkFBaUI7QUFBQSxVQUNmLFdBQVcsT0FBTztBQUFBLFVBQ2xCLEtBQUs7QUFBQSxVQUNMLFNBQVM7QUFBQSxVQUNULFlBQVk7QUFBQSxZQUNWLFFBQVEsQ0FBQyxjQUFjO0FBQUEsVUFDekI7QUFBQSxRQUNGLENBQUMsSUFDRDtBQUFBLE1BQ047QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0Y7IiwKICAibmFtZXMiOiBbInBhdGgiLCAiZGVmaW5lQ29uZmlnIiwgImxvYWRFbnYiLCAidml0ZV9jb25maWdfZGVmYXVsdCIsICJsb2FkRW52IiwgInBhdGgiLCAiZGVmaW5lQ29uZmlnIl0KfQo=
