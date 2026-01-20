"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocationVirtual = void 0;
var isLocationVirtual = function (location) {
    var _a, _b;
    return ((_b = (_a = location.extension) === null || _a === void 0 ? void 0 : _a[0].valueCoding) === null || _b === void 0 ? void 0 : _b.code) === 'vi';
};
exports.isLocationVirtual = isLocationVirtual;
