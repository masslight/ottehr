"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var globalSetup = function (_config) {
    // Global setup logic here
    // all we're doing is validating that the PLAYWRIGHT_SUITE_ID environment variable has been set as expected
    var processId = process.env.PLAYWRIGHT_SUITE_ID;
    if (!processId) {
        throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
    }
    if (!processId.startsWith('ehr-')) {
        throw new Error('PLAYWRIGHT_SUITE_ID must start with "ehr-". Current value: ' + processId);
    }
};
exports.default = globalSetup;
//# sourceMappingURL=index.js.map