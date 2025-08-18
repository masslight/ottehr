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
exports.useMappedVisitDataStore = void 0;
var zustand_1 = require("zustand");
var MAPPED_VISIT_DATA_INITIAL = { resources: {}, mappedData: {} };
exports.useMappedVisitDataStore = (0, zustand_1.create)()(function () { return (__assign({}, MAPPED_VISIT_DATA_INITIAL)); });
//# sourceMappingURL=parsedAppointment.store.js.map