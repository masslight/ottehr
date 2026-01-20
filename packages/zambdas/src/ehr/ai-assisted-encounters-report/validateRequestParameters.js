"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('Missing request body');
    }
    var _a = JSON.parse(input.body), dateRange = _a.dateRange, locationIds = _a.locationIds;
    if (!dateRange) {
        throw new Error('Missing dateRange parameter');
    }
    if (!dateRange.start || !dateRange.end) {
        throw new Error('dateRange must include both start and end dates');
    }
    // Validate that start and end are valid ISO date strings
    if (isNaN(Date.parse(dateRange.start))) {
        throw new Error('dateRange.start must be a valid ISO date string');
    }
    if (isNaN(Date.parse(dateRange.end))) {
        throw new Error('dateRange.end must be a valid ISO date string');
    }
    // Validate locationIds if provided
    if (locationIds !== undefined && !Array.isArray(locationIds)) {
        throw new Error('locationIds must be an array');
    }
    if (!input.secrets) {
        throw new Error('Input did not have any secrets');
    }
    return {
        dateRange: dateRange,
        locationIds: locationIds,
        secrets: input.secrets,
    };
}
