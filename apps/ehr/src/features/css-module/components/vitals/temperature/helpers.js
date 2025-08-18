"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.celsiusToFahrenheit = exports.textToTemperatureNumber = void 0;
var utils_1 = require("utils");
var textToTemperatureNumber = function (text) {
    var tempVal = (0, utils_1.textToNumericValue)(text);
    if (!tempVal)
        return;
    return roundTemperatureValue(tempVal);
};
exports.textToTemperatureNumber = textToTemperatureNumber;
var celsiusToFahrenheit = function (tempInCelsius) {
    return roundTemperatureValue((9 / 5) * tempInCelsius + 32);
};
exports.celsiusToFahrenheit = celsiusToFahrenheit;
var roundTemperatureValue = function (temperature) { return (0, utils_1.roundNumberToDecimalPlaces)(temperature, 1); };
//# sourceMappingURL=helpers.js.map