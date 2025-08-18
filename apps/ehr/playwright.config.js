"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var test_1 = require("@playwright/test");
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 * require('dotenv').config();
 *
 * See https://playwright.dev/docs/test-configuration.
 */
exports.default = (0, test_1.defineConfig)({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    reporter: [['html'], ['list'], ['junit', { outputFile: 'test-results/results.xml' }]],
    use: {
        baseURL: process.env.WEBSITE_URL,
        trace: process.env.CI ? 'on-first-retry' : 'on',
        screenshot: process.env.CI ? 'only-on-failure' : 'off',
        video: process.env.CI ? 'retain-on-failure' : 'off',
        actionTimeout: 25000,
        navigationTimeout: 30000,
    },
    timeout: 120000,
    expect: {
        timeout: 25000,
    },
    projects: [
        {
            name: 'chromium',
            use: __assign(__assign({}, test_1.devices['Desktop Chrome']), { storageState: './playwright/user.json' }),
        },
    ],
    retries: process.env.CI ? 2 : 0,
    outputDir: 'test-results/',
    workers: process.env.CI ? 6 : undefined,
    testIgnore: ['tests/e2e/specs/employees.spec.ts'],
    globalSetup: './tests/global-setup/index.ts',
    globalTeardown: './tests/global-teardown/index.ts',
});
//# sourceMappingURL=playwright.config.js.map