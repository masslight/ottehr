"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToHeightNumber = void 0;
var utils_1 = require("utils");
var textToHeightNumber = function (text) {
    var heightVal = (0, utils_1.textToNumericValue)(text);
    if (!heightVal)
        return;
    return roundHeightValue(heightVal);
};
exports.textToHeightNumber = textToHeightNumber;
var roundHeightValue = function (heightVal) { return (0, utils_1.roundNumberToDecimalPlaces)(heightVal, 1); };
//# sourceMappingURL=helpers.js.map