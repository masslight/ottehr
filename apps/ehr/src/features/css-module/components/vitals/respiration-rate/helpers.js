"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToRespirationRateNumber = void 0;
var utils_1 = require("utils");
var textToRespirationRateNumber = function (text) {
    var respRateVal = (0, utils_1.textToNumericValue)(text);
    if (!respRateVal)
        return;
    return (0, utils_1.roundNumberToDecimalPlaces)(respRateVal, 0);
};
exports.textToRespirationRateNumber = textToRespirationRateNumber;
//# sourceMappingURL=helpers.js.map