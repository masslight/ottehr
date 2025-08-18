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
exports.FeatureFlagsProvider = void 0;
exports.useFeatureFlags = useFeatureFlags;
var react_1 = require("react");
var initialFlags = {
    css: false,
};
var FeatureFlagsContext = (0, react_1.createContext)(null);
var FeatureFlagsProvider = function (_a) {
    var children = _a.children, flagsToSet = _a.flagsToSet;
    var _b = (0, react_1.useState)(__assign(__assign({}, initialFlags), flagsToSet)), flags = _b[0], setFlags = _b[1];
    var setFlag = (0, react_1.useCallback)(function (key, value) {
        setFlags(function (prevFlags) {
            var _a;
            if (prevFlags[key] === value)
                return prevFlags;
            return __assign(__assign({}, prevFlags), (_a = {}, _a[key] = value, _a));
        });
    }, []);
    var value = (0, react_1.useMemo)(function () { return ({
        setFlag: setFlag,
        flags: flags,
    }); }, [setFlag, flags]);
    return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};
exports.FeatureFlagsProvider = FeatureFlagsProvider;
function useFeatureFlags(arg) {
    var context = (0, react_1.useContext)(FeatureFlagsContext);
    (0, react_1.useEffect)(function () {
        if (!context) {
            return;
        }
        if (arg && typeof arg === 'object') {
            Object.entries(arg).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                if (typeof value === 'boolean') {
                    context === null || context === void 0 ? void 0 : context.setFlag(key, value);
                }
            });
        }
    }, [arg, context]);
    if (!context) {
        console.warn('useFeatureFlags must be used within a FeatureFlagsProvider, default values will be used');
        return initialFlags;
    }
    return context.flags;
}
//# sourceMappingURL=featureFlags.js.map