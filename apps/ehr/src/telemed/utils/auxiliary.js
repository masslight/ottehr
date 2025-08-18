"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arraysEqual = void 0;
var arraysEqual = function (arr1, arr2) {
    var sortedArr1 = __spreadArray([], arr1, true).sort();
    var sortedArr2 = __spreadArray([], arr2, true).sort();
    if (sortedArr1 === sortedArr2)
        return true;
    if (sortedArr1 == null || sortedArr2 == null)
        return false;
    if (sortedArr1.length !== sortedArr2.length)
        return false;
    for (var i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i])
            return false;
    }
    return true;
};
exports.arraysEqual = arraysEqual;
//# sourceMappingURL=auxiliary.js.map