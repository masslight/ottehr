"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var formatString_1 = require("./formatString");
(0, vitest_1.describe)('addSpacesAfterCommas', function () {
    (0, vitest_1.it)('should add spaces after commas where they are missing', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('Fever,Vomiting and/or diarrhea')).toBe('Fever, Vomiting and/or diarrhea');
    });
    (0, vitest_1.it)('should not add extra spaces if they already exist', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('Fever, Vomiting, and/or diarrhea')).toBe('Fever, Vomiting, and/or diarrhea');
    });
    (0, vitest_1.it)('should handle multiple consecutive commas', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('One,Two,,Three,Four')).toBe('One, Two, , Three, Four');
    });
    (0, vitest_1.it)('should handle commas at the end of the string', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('One,Two,Three,')).toBe('One, Two, Three,');
    });
    (0, vitest_1.it)('should return the same string if there are no commas', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('No commas here')).toBe('No commas here');
    });
    (0, vitest_1.it)('should handle empty strings', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('')).toBe('');
    });
    (0, vitest_1.it)('should handle strings with only commas', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)(',,,,')).toBe(', , , ,');
    });
    (0, vitest_1.it)('should preserve existing whitespace', function () {
        (0, vitest_1.expect)((0, formatString_1.addSpacesAfterCommas)('One,  Two,Three')).toBe('One,  Two, Three');
    });
});
//# sourceMappingURL=formatString.test.js.map