"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSpacesAfterCommas = addSpacesAfterCommas;
/**
 * Adds a space after each comma in a string, if it doesn't already exist.
 * @param str - The original string
 * @returns A string with spaces after commas
 */
function addSpacesAfterCommas(str) {
    return str.replace(/,(?=[^\s])/g, ', ');
}
//# sourceMappingURL=formatString.js.map