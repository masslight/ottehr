"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), dateFilter = _a.dateFilter, timeZone = _a.timeZone, usStatesFilter = _a.usStatesFilter, statusesFilter = _a.statusesFilter, patientFilter = _a.patientFilter, locationsIdsFilter = _a.locationsIdsFilter, visitTypesFilter = _a.visitTypesFilter;
    if (statusesFilter === undefined) {
        throw new Error('These fields are required: "statusesFilter"');
    }
    if (patientFilter === undefined) {
        throw new Error('These fields are required: "patientFilter"');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    // Ensure dateFilter is in YYYY-MM-DD format if provided
    if (dateFilter) {
        var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateFilter)) {
            throw new Error('dateFilter must be in YYYY-MM-DD format');
        }
    }
    if (timeZone) {
        if (!Intl.supportedValuesOf('timeZone').includes(timeZone) && timeZone !== 'UTC') {
            throw new Error("Invalid timeZone: ".concat(timeZone));
        }
    }
    if (dateFilter && !timeZone) {
        throw new Error('timeZone is required when dateFilter is provided');
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        dateFilter: dateFilter,
        timeZone: timeZone,
        usStatesFilter: usStatesFilter,
        patientFilter: patientFilter,
        statusesFilter: statusesFilter,
        secrets: input.secrets,
        userToken: userToken,
        locationsIdsFilter: locationsIdsFilter,
        visitTypesFilter: visitTypesFilter,
    };
}
