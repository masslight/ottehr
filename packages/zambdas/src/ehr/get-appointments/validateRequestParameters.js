"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    // Parse and validate the JSON body
    var parsedBody;
    try {
        parsedBody = JSON.parse(input.body);
    }
    catch (_a) {
        throw new Error('Invalid JSON in request body');
    }
    // Validate that the parsed body is an object
    if (!parsedBody || typeof parsedBody !== 'object') {
        throw new Error('Request body must be a valid JSON object');
    }
    var body = parsedBody;
    // Safely extract and validate searchDate (required string)
    if (typeof body.searchDate !== 'string') {
        throw new Error('searchDate is required and must be a string');
    }
    var searchDate = body.searchDate;
    // Safely extract and validate locationID (optional string)
    var locationID;
    if (body.locationID !== undefined) {
        if (typeof body.locationID !== 'string') {
            throw new Error('locationID must be a string if provided');
        }
        locationID = body.locationID;
    }
    // Safely extract and validate providerIDs (optional string array)
    var providerIDs;
    if (body.providerIDs !== undefined) {
        if (!Array.isArray(body.providerIDs)) {
            throw new Error('providerIDs must be an array if provided');
        }
        if (!body.providerIDs.every(function (id) { return typeof id === 'string'; })) {
            throw new Error('All providerIDs must be strings');
        }
        providerIDs = body.providerIDs;
    }
    // Safely extract and validate groupIDs (optional string array)
    var groupIDs;
    if (body.groupIDs !== undefined) {
        if (!Array.isArray(body.groupIDs)) {
            throw new Error('groupIDs must be an array if provided');
        }
        if (!body.groupIDs.every(function (id) { return typeof id === 'string'; })) {
            throw new Error('All groupIDs must be strings');
        }
        groupIDs = body.groupIDs;
    }
    // Safely extract and validate visitType (required string array)
    if (!Array.isArray(body.visitType)) {
        throw new Error('visitType is required and must be an array');
    }
    if (!body.visitType.every(function (type) { return typeof type === 'string'; })) {
        throw new Error('All visitType values must be strings');
    }
    var visitType = body.visitType;
    // Validate business logic constraints
    if (locationID === undefined && providerIDs === undefined && groupIDs === undefined) {
        throw new Error('Either "locationID" or "providerIDs" or "groupIDs" is required');
    }
    var supervisorApprovalEnabled = typeof body.supervisorApprovalEnabled === 'boolean' ? body.supervisorApprovalEnabled : false;
    return {
        searchDate: searchDate,
        locationID: locationID,
        providerIDs: providerIDs,
        groupIDs: groupIDs,
        visitType: visitType,
        supervisorApprovalEnabled: supervisorApprovalEnabled,
        secrets: input.secrets,
    };
}
