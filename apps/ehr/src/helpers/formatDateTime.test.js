"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var formatDateTime_1 = require("./formatDateTime");
(0, vitest_1.describe)('calculatePatientAge', function () {
    var dateNow = luxon_1.DateTime.fromISO('2024-01-01T00:00:00.000Z');
    var getDateString = function (yearsAgo, monthsAgo, daysAgo) {
        if (monthsAgo === void 0) { monthsAgo = 0; }
        if (daysAgo === void 0) { daysAgo = 0; }
        return dateNow.minus({ years: yearsAgo, months: monthsAgo, days: daysAgo }).toISODate();
    };
    (0, vitest_1.beforeAll)(function () {
        vitest_1.vi.useFakeTimers();
        vitest_1.vi.setSystemTime(dateNow.toJSDate());
    });
    (0, vitest_1.afterAll)(function () {
        vitest_1.vi.useRealTimers();
    });
    (0, vitest_1.it)('should return empty string for null or undefined input', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(null)).toBe(null);
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(undefined)).toBe(undefined);
    });
    (0, vitest_1.it)('should return empty string for invalid date', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)('invalid-date')).toBe('');
    });
    (0, vitest_1.it)('should return age in years if 2 years or older', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(2))).toBe('2 y');
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(4))).toBe('4 y');
    });
    (0, vitest_1.it)('should return age in months if between 2 months and 2 years', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(0, 2))).toBe('2 m');
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(1, 7))).toBe('19 m');
    });
    (0, vitest_1.it)('should return age in days if less than 2 months', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(0, 0, 1))).toBe('1 d');
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(0, 0, 30))).toBe('30 d');
    });
    (0, vitest_1.it)('should handle edge cases around year and month boundaries', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(1, 11, 10))).toBe('23 m');
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(0, 1, 28))).toBe('59 d');
    });
    (0, vitest_1.it)('should handle future dates', function () {
        (0, vitest_1.expect)((0, utils_1.calculatePatientAge)(getDateString(-1))).toBe('0 d');
    });
});
(0, vitest_1.describe)('formatDateTime helpers', function () {
    (0, vitest_1.describe)('formatHourNumber', function () {
        (0, vitest_1.it)('should format hour number correctly', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(0)).toBe('12 AM');
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(1)).toBe('1 AM');
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(12)).toBe('12 PM');
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(13)).toBe('1 PM');
        });
        (0, vitest_1.it)('should handle edge cases', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(-1)).toBe('Invalid DateTime');
            (0, vitest_1.expect)((0, formatDateTime_1.formatHourNumber)(25)).toBe('Invalid DateTime');
        });
    });
    (0, vitest_1.describe)('formatDateUsingSlashes', function () {
        (0, vitest_1.it)('should format date using slashes', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatDateUsingSlashes)('2023-05-15')).toBe('05/15/2023');
        });
        (0, vitest_1.it)('should return undefined for undefined input', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatDateUsingSlashes)(undefined)).toBeUndefined();
        });
        (0, vitest_1.it)('should handle invalid date strings', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatDateUsingSlashes)('invalid-date')).toBe('Invalid DateTime');
        });
    });
    (0, vitest_1.describe)('datesCompareFn', function () {
        var compareFn = (0, formatDateTime_1.datesCompareFn)('MM/dd/yyyy');
        (0, vitest_1.it)('should compare dates correctly', function () {
            (0, vitest_1.expect)(compareFn('05/15/2023', '05/16/2023')).toBeLessThan(0);
            (0, vitest_1.expect)(compareFn('05/16/2023', '05/15/2023')).toBeGreaterThan(0);
            (0, vitest_1.expect)(compareFn('05/15/2023', '05/15/2023')).toBe(0);
            (0, vitest_1.expect)(compareFn('12/31/2023', '01/01/2024')).toBeLessThan(0);
        });
        (0, vitest_1.it)('should handle invalid date strings', function () {
            (0, vitest_1.expect)(compareFn('invalid', '05/15/2023')).toBeNaN();
            (0, vitest_1.expect)(compareFn('05/15/2023', 'invalid')).toBeNaN();
        });
    });
    (0, vitest_1.describe)('formatISODateToLocaleDate', function () {
        (0, vitest_1.it)('should format ISO date to locale date', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatISODateToLocaleDate)('2023-05-15')).toBe('May 15, 2023');
            (0, vitest_1.expect)((0, formatDateTime_1.formatISODateToLocaleDate)('2023-12-31')).toBe('Dec 31, 2023');
            (0, vitest_1.expect)((0, formatDateTime_1.formatISODateToLocaleDate)('2023-01-01')).toBe('Jan 01, 2023');
        });
        (0, vitest_1.it)('should return undefined for undefined input', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatISODateToLocaleDate)(undefined)).toBeUndefined();
        });
        (0, vitest_1.it)('should handle invalid date strings', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatISODateToLocaleDate)('invalid-date')).toBe('Invalid DateTime');
        });
    });
    (0, vitest_1.describe)('formatISOStringToDateAndTime', function () {
        (0, vitest_1.it)('should format ISO string to date and time', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatISOStringToDateAndTime)('2023-05-15T14:30:00')).toBe('05/15/2023, 14:30');
            (0, vitest_1.expect)((0, formatDateTime_1.formatISOStringToDateAndTime)('2023-12-31T23:59:59')).toBe('12/31/2023, 23:59');
            (0, vitest_1.expect)((0, formatDateTime_1.formatISOStringToDateAndTime)('2023-01-01T00:00:00')).toBe('01/01/2023, 00:00');
        });
        (0, vitest_1.it)('should handle invalid ISO strings', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.formatISOStringToDateAndTime)('invalid')).toBe('Invalid DateTime');
        });
    });
    (0, vitest_1.describe)('getTimezone', function () {
        (0, vitest_1.it)('should return default timezone if location is undefined', function () {
            (0, vitest_1.expect)((0, formatDateTime_1.getTimezone)(undefined)).toBe('America/New_York');
        });
        (0, vitest_1.it)('should return timezone from location extension', function () {
            var location = {
                extension: [
                    {
                        url: 'http://hl7.org/fhir/StructureDefinition/timezone',
                        valueString: 'Europe/London',
                    },
                ],
            };
            (0, vitest_1.expect)((0, formatDateTime_1.getTimezone)(location)).toBe('Europe/London');
        });
        (0, vitest_1.it)('should return default timezone if extension is not found', function () {
            var location = {
                extension: [
                    {
                        url: 'some-other-url',
                        valueString: 'Europe/London',
                    },
                ],
            };
            (0, vitest_1.expect)((0, formatDateTime_1.getTimezone)(location)).toBe('America/New_York');
        });
        (0, vitest_1.it)('should return default timezone if extension array is empty', function () {
            var location = { extension: [] };
            (0, vitest_1.expect)((0, formatDateTime_1.getTimezone)(location)).toBe('America/New_York');
        });
    });
});
//# sourceMappingURL=formatDateTime.test.js.map