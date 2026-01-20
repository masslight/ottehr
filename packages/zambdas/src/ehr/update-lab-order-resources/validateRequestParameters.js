"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var secrets = input.secrets;
    var params;
    try {
        params = JSON.parse(input.body);
    }
    catch (_a) {
        throw Error('Invalid JSON in request body');
    }
    if (!Object.values(utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS).includes(params.event)) {
        throw Error("Invalid parameter: event must be \"".concat(Object.values(utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS).join('", "'), "\", received \"").concat(params.event, "\""));
    }
    if (params.event === 'reviewed') {
        var taskId = params.taskId, serviceRequestId = params.serviceRequestId, diagnosticReportId = params.diagnosticReportId, event_1 = params.event;
        if (typeof taskId !== 'string') {
            throw Error('Invalid parameter type: taskId must be a string');
        }
        // todo it would be nice to have better typing such that is knows serviceRequestId will be undefined if this review is for an unsolicited result
        // if (typeof serviceRequestId !== 'string') {
        //   throw Error('Invalid parameter type: serviceRequestId must be a string');
        // }
        if (typeof diagnosticReportId !== 'string') {
            throw Error('Invalid parameter type: diagnosticReportId must be a string');
        }
        return {
            serviceRequestId: serviceRequestId,
            diagnosticReportId: diagnosticReportId,
            taskId: taskId,
            event: event_1,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === 'specimenDateChanged') {
        var serviceRequestId = params.serviceRequestId, specimenId = params.specimenId, date = params.date, event_2 = params.event;
        if (!luxon_1.DateTime.fromISO(date).isValid) {
            throw Error('Invalid parameter: date must be a valid ISO 8601 date string');
        }
        if (typeof serviceRequestId !== 'string') {
            throw Error("Invalid parameter type: serviceRequestId must be a string, received: ".concat(typeof serviceRequestId));
        }
        if (typeof specimenId !== 'string') {
            throw Error("Invalid parameter type: specimenId must be a string, received: ".concat(typeof specimenId));
        }
        return {
            serviceRequestId: serviceRequestId,
            specimenId: specimenId,
            date: date,
            event: event_2,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === 'saveOrderCollectionData') {
        var serviceRequestId = params.serviceRequestId, data = params.data, specimenCollectionDates = params.specimenCollectionDates, event_3 = params.event;
        if (typeof serviceRequestId !== 'string') {
            throw Error("Invalid parameter type: serviceRequestId must be a string, received: ".concat(typeof serviceRequestId));
        }
        if (!data || !Object.keys(data).every(function (key) { return typeof key === 'string'; })) {
            throw Error("Missing data param or data key is an invalid type");
        }
        if (specimenCollectionDates &&
            !Object.values(specimenCollectionDates).every(function (specimen) { return typeof specimen.date === 'string'; })) {
            throw Error("Invalid parameter: specimenCollectionDates.date must be a string");
        }
        return {
            serviceRequestId: serviceRequestId,
            data: data,
            specimenCollectionDates: specimenCollectionDates,
            event: event_3,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.cancelUnsolicitedResultTask) {
        var taskId = params.taskId, event_4 = params.event;
        return {
            taskId: taskId,
            event: event_4,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.matchUnsolicitedResult) {
        var event_5 = params.event, taskId = params.taskId, diagnosticReportId = params.diagnosticReportId, patientToMatchId = params.patientToMatchId, srToMatchId = params.srToMatchId;
        return {
            event: event_5,
            taskId: taskId,
            diagnosticReportId: diagnosticReportId,
            patientToMatchId: patientToMatchId,
            srToMatchId: srToMatchId,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.rejectedAbn) {
        var event_6 = params.event, serviceRequestId = params.serviceRequestId;
        return {
            event: event_6,
            serviceRequestId: serviceRequestId,
            secrets: secrets,
            userToken: userToken,
        };
    }
    else if (params.event === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.addOrderLevelNote ||
        params.event === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.updateOrderLevelNote) {
        var event_7 = params.event, requisitionNumber = params.requisitionNumber, note = params.note;
        if (typeof requisitionNumber !== 'string') {
            throw Error("Invalid parameter type: requisitionNumber must be a string, received: ".concat(typeof requisitionNumber));
        }
        if (typeof note !== 'string') {
            throw Error("Invalid parameter type: note must be a string, received: ".concat(typeof note));
        }
        if (note.length > 300) {
            throw Error("Note must be under 300 characters long, length of note: ".concat(note.length));
        }
        return {
            event: event_7,
            requisitionNumber: requisitionNumber,
            note: note,
            secrets: secrets,
            userToken: userToken,
        };
    }
    throw Error('Event is not supported.');
}
