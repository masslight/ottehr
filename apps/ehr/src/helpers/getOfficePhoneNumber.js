"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOfficePhoneNumber = void 0;
var utils_1 = require("utils");
var PLACEHOLDER_PHONE_NUMBER = '[office phone number]';
var getOfficePhoneNumber = function (location) {
    var _a, _b, _c;
    var locationToUse = location;
    if (locationToUse === undefined) {
        var storedLoc = localStorage.getItem('selectedLocation');
        if (storedLoc) {
            try {
                locationToUse = JSON.parse(storedLoc);
            }
            catch (_d) {
                console.error('location could not be parsed from local storage');
            }
        }
    }
    try {
        if (!locationToUse || typeof locationToUse !== 'object' || locationToUse.resourceType !== 'Location') {
            return PLACEHOLDER_PHONE_NUMBER;
        }
        var officePhoneNumber = (_b = (_a = locationToUse === null || locationToUse === void 0 ? void 0 : locationToUse.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecomTemp) { return telecomTemp.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value;
        return (_c = (0, utils_1.standardizePhoneNumber)(officePhoneNumber)) !== null && _c !== void 0 ? _c : PLACEHOLDER_PHONE_NUMBER;
    }
    catch (error) {
        console.error('Error parsing location from storage:', error);
        return PLACEHOLDER_PHONE_NUMBER;
    }
};
exports.getOfficePhoneNumber = getOfficePhoneNumber;
//# sourceMappingURL=getOfficePhoneNumber.js.map