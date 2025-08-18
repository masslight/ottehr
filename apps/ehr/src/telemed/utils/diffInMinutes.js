"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffInMinutes = void 0;
var diffInMinutes = function (laterDate, earlierDate) {
    return Math.round(laterDate.diff(earlierDate, 'minutes').minutes);
};
exports.diffInMinutes = diffInMinutes;
//# sourceMappingURL=diffInMinutes.js.map