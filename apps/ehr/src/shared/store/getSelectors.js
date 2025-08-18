"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSelectors = void 0;
var getSelectors = function (store, stateKeys
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var selectors = {};
    var _loop_1 = function (key) {
        selectors[key] = store(function (state) { return state[key]; });
    };
    for (var _i = 0, stateKeys_1 = stateKeys; _i < stateKeys_1.length; _i++) {
        var key = stateKeys_1[_i];
        _loop_1(key);
    }
    return selectors;
};
exports.getSelectors = getSelectors;
//# sourceMappingURL=getSelectors.js.map