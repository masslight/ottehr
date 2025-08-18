"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var matchers = require("@testing-library/jest-dom/matchers");
var react_1 = require("@testing-library/react");
var vitest_1 = require("vitest");
vitest_1.expect.extend(matchers);
(0, vitest_1.afterEach)(function () {
    (0, react_1.cleanup)();
});
//# sourceMappingURL=setup.js.map