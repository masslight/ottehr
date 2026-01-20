"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStatesToLocationIds = exports.mapQuestionnaireToEncountersIds = exports.getTelemedEncounterAppointmentId = exports.mapTelemedEncountersToAppointmentsIdsMap = exports.mapTelemedStatusToEncounterAndAppointment = void 0;
var helpers_1 = require("../../../shared/appointment/helpers");
var helpers_2 = require("../../../shared/helpers");
var helpers_3 = require("./helpers");
var mapTelemedStatusToEncounterAndAppointment = function (telemedStatuses) {
    var encounterStatuses = [];
    var appointmentStatuses = [];
    telemedStatuses.forEach(function (status) {
        encounterStatuses.push((0, helpers_1.telemedStatusToEncounter)(status));
        appointmentStatuses.push((0, helpers_3.telemedStatusToAppointment)(status));
    });
    // removing duplications before returning
    return {
        encounterStatuses: encounterStatuses.filter(function (status, index) { return encounterStatuses.lastIndexOf(status) === index; }),
        appointmentStatuses: appointmentStatuses.filter(function (status, index) { return appointmentStatuses.lastIndexOf(status) === index; }),
    };
};
exports.mapTelemedStatusToEncounterAndAppointment = mapTelemedStatusToEncounterAndAppointment;
var mapTelemedEncountersToAppointmentsIdsMap = function (allResources) {
    var appointmentEncounterMap = {};
    // getting all encounters with virtual service extension used for video room
    // that have reference to appointments
    allResources.forEach(function (resource) {
        var appointmentId = (0, exports.getTelemedEncounterAppointmentId)(resource);
        if (appointmentId) {
            appointmentEncounterMap[appointmentId] = resource;
        }
    });
    return appointmentEncounterMap;
};
exports.mapTelemedEncountersToAppointmentsIdsMap = mapTelemedEncountersToAppointmentsIdsMap;
var getTelemedEncounterAppointmentId = function (encounterResource) {
    var _a;
    if (!(encounterResource.resourceType === 'Encounter' && (0, helpers_2.getVideoRoomResourceExtension)(encounterResource)))
        return undefined;
    var appointmentReference = ((_a = encounterResource === null || encounterResource === void 0 ? void 0 : encounterResource.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) || '';
    var appointmentId = (0, helpers_1.removePrefix)('Appointment/', appointmentReference);
    return appointmentId;
};
exports.getTelemedEncounterAppointmentId = getTelemedEncounterAppointmentId;
var mapQuestionnaireToEncountersIds = function (allResources) {
    var questionnaireAppointmentsMap = {};
    allResources.forEach(function (resource) {
        var _a;
        if (resource.resourceType === 'QuestionnaireResponse') {
            var questionnaire = resource;
            var encounterReference = (_a = questionnaire.encounter) === null || _a === void 0 ? void 0 : _a.reference;
            if (encounterReference) {
                var encounterId = (0, helpers_1.removePrefix)('Encounter/', encounterReference);
                if (encounterId)
                    questionnaireAppointmentsMap[encounterId] = questionnaire;
            }
        }
    });
    return questionnaireAppointmentsMap;
};
exports.mapQuestionnaireToEncountersIds = mapQuestionnaireToEncountersIds;
var mapStatesToLocationIds = function (statesAbbreviations, virtualLocationsMap) {
    var resultIds = [];
    statesAbbreviations.forEach(function (abbreviation) {
        var locations = virtualLocationsMap[abbreviation];
        if (locations && locations.length > 0) {
            locations.forEach(function (location) {
                resultIds.push(location.id);
            });
        }
    });
    return resultIds;
};
exports.mapStatesToLocationIds = mapStatesToLocationIds;
