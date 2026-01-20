"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
// Mock @sentry/aws-serverless to avoid SSR import issues during tests
vitest_1.vi.mock('@sentry/aws-serverless', function () { return ({
    init: vitest_1.vi.fn(),
    isInitialized: vitest_1.vi.fn(function () { return false; }),
    setTag: vitest_1.vi.fn(),
    wrapHandler: vitest_1.vi.fn(function (handler) { return handler; }), // Pass through the handler without modification
}); });
