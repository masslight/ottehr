"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDebounce = void 0;
var react_1 = require("react");
var useDebounce = function (timeout) {
    if (timeout === void 0) { timeout = 500; }
    var timeoutRef = (0, react_1.useRef)();
    var debounce = function (func) {
        if (timeoutRef.current) {
            clear();
        }
        timeoutRef.current = setTimeout(function () {
            func();
        }, timeout);
    };
    var clear = function () {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
    };
    return { debounce: debounce, clear: clear };
};
exports.useDebounce = useDebounce;
//# sourceMappingURL=useDebounce.js.map