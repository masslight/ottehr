// vite.config.ts
import { resolve } from "path";
import { defineConfig } from "file:///Users/valerii/Documents/projects/ottehr/node_modules/vitest/dist/config.js";
var __vite_injected_original_dirname = "/Users/valerii/Documents/projects/ottehr/packages/test-utils";
var vite_config_default = defineConfig({
  test: {
    globals: true
  },
  plugins: [],
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "lib/main.ts"),
      formats: ["es"]
    },
    rollupOptions: {
      external: [/^node:/, /^@playwright/, "playwright", "fs", "path", "crypto", "util", "child_process"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmFsZXJpaS9Eb2N1bWVudHMvcHJvamVjdHMvb3R0ZWhyL3BhY2thZ2VzL3Rlc3QtdXRpbHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92YWxlcmlpL0RvY3VtZW50cy9wcm9qZWN0cy9vdHRlaHIvcGFja2FnZXMvdGVzdC11dGlscy92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmFsZXJpaS9Eb2N1bWVudHMvcHJvamVjdHMvb3R0ZWhyL3BhY2thZ2VzL3Rlc3QtdXRpbHMvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICB9LFxuICBwbHVnaW5zOiBbXSxcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgJ2xpYi9tYWluLnRzJyksXG4gICAgICBmb3JtYXRzOiBbJ2VzJ10sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBleHRlcm5hbDogWy9ebm9kZTovLCAvXkBwbGF5d3JpZ2h0LywgJ3BsYXl3cmlnaHQnLCAnZnMnLCAncGF0aCcsICdjcnlwdG8nLCAndXRpbCcsICdjaGlsZF9wcm9jZXNzJ10sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVyxTQUFTLGVBQWU7QUFDOVgsU0FBUyxvQkFBb0I7QUFEN0IsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLEVBQ1g7QUFBQSxFQUNBLFNBQVMsQ0FBQztBQUFBLEVBQ1YsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUN2QyxTQUFTLENBQUMsSUFBSTtBQUFBLElBQ2hCO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsVUFBVSxnQkFBZ0IsY0FBYyxNQUFNLFFBQVEsVUFBVSxRQUFRLGVBQWU7QUFBQSxJQUNwRztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
