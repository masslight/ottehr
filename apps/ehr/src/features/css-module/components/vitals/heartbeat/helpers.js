"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToHeartbeatNumber = void 0;
var utils_1 = require("utils");
var textToHeartbeatNumber = function (text) {
    var hrVal = (0, utils_1.textToNumericValue)(text);
    if (!hrVal)
        return;
    return (0, utils_1.roundNumberToDecimalPlaces)(hrVal, 0);
};
exports.textToHeartbeatNumber = textToHeartbeatNumber;
//# sourceMappingURL=helpers.js.map