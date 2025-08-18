"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToBloodPressureNumber = void 0;
var utils_1 = require("utils");
var textToBloodPressureNumber = function (text) {
    var bpVal = (0, utils_1.textToNumericValue)(text);
    if (!bpVal)
        return;
    return roundPressureValue(bpVal);
};
exports.textToBloodPressureNumber = textToBloodPressureNumber;
var roundPressureValue = function (bpVal) { return (0, utils_1.roundNumberToDecimalPlaces)(bpVal, 0); };
//# sourceMappingURL=helpers.js.map