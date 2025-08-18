"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var plugin_react_1 = require("@vitejs/plugin-react");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var vite_tsconfig_paths_1 = require("vite-tsconfig-paths");
var config_1 = require("vitest/config");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, 'env/.env.local') });
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        include: ['**/*.test.tsx'],
        setupFiles: './tests/component/setup.ts',
        environment: 'jsdom',
    },
    plugins: [(0, vite_tsconfig_paths_1.default)(), (0, plugin_react_1.default)()],
});
//# sourceMappingURL=vitest.config.component-tests.js.map