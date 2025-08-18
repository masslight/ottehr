"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToOxygenSatNumber = void 0;
var utils_1 = require("utils");
var textToOxygenSatNumber = function (text) {
    var oxySatVal = (0, utils_1.textToNumericValue)(text);
    if (!oxySatVal)
        return;
    return (0, utils_1.roundNumberToDecimalPlaces)(oxySatVal, 0);
};
exports.textToOxygenSatNumber = textToOxygenSatNumber;
//# sourceMappingURL=helpers.js.map