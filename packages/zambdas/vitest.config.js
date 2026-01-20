"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        environment: 'node',
        silent: true,
        testTimeout: 180000, // 3 minutes
        hookTimeout: 30000, // 30 seconds
        teardownTimeout: 30000, // 30 seconds
        globalSetup: './test/helpers/integration-global-setup.ts',
        setupFiles: ['./vitest.setup.ts'],
        server: {
            deps: {
                inline: [/@sentry/, /utils/],
            },
        },
    },
});
