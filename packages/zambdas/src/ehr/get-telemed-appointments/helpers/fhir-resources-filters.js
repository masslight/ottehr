"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterAppointmentsAndCreatePackages = exports.filterPatientForAppointment = exports.findVirtualLocationForAppointment = void 0;
var utils_1 = require("utils");
var helpers_1 = require("../../../shared/appointment/helpers");
var helpers_2 = require("../../../shared/helpers");
var helpers_3 = require("./helpers");
var mappers_1 = require("./mappers");
var findVirtualLocationForAppointment = function (appointment, virtualLocationsMap) {
    var locationId = (0, helpers_3.getLocationIdFromAppointment)(appointment);
    if (locationId) {
        var stateAbbreviation = Object.keys(virtualLocationsMap).find(function (abbreviation) {
            return virtualLocationsMap[abbreviation].find(function (location) { return location.id === locationId; });
        });
        if (!stateAbbreviation) {
            console.error('No state abbreviation found for location', locationId);
            return undefined;
        }
        var location_1 = virtualLocationsMap[stateAbbreviation].find(function (location) { return location.id === locationId; });
        return {
            reference: locationId ? "Location/".concat(locationId) : undefined,
            name: location_1.name,
            state: stateAbbreviation,
            resourceType: 'Location',
            id: locationId,
            extension: location_1.extension,
        };
    }
    return undefined;
};
exports.findVirtualLocationForAppointment = findVirtualLocationForAppointment;
var filterPatientForAppointment = function (appointment, allResources) {
    var _a, _b, _c;
    var patientId = (_c = (_b = (_a = appointment.participant
        .find(function (appt) { var _a, _b; return (_b = (_a = appt.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Patient/', '');
    var patient = allResources.find(function (resourceTemp) { return resourceTemp.id === patientId; });
    return patient;
};
exports.filterPatientForAppointment = filterPatientForAppointment;
var filterPractitionerForEncounter = function (allResources, encounter) {
    var _a, _b, _c;
    // console.log('encounter for appointment: ' + JSON.stringify(encounter));
    var practitionerRef = (_c = (_b = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (part) { var _a, _b; return (_b = (_a = part.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.includes('Practitioner/'); })) === null || _b === void 0 ? void 0 : _b.individual) === null || _c === void 0 ? void 0 : _c.reference;
    if (practitionerRef) {
        var practitionerId_1 = (0, helpers_1.removePrefix)('Practitioner/', practitionerRef);
        return allResources.find(function (res) { return res.id === practitionerId_1; });
    }
    return undefined;
};
var filterAppointmentsAndCreatePackages = function (_a) {
    var allResources = _a.allResources, statusesFilter = _a.statusesFilter, virtualLocationsMap = _a.virtualLocationsMap, visitTypes = _a.visitTypes, locationsIdsFilter = _a.locationsIdsFilter;
    var resultAppointments = [];
    var appointmentEncounterMap = (0, mappers_1.mapTelemedEncountersToAppointmentsIdsMap)(allResources);
    var encounterQuestionnaireMap = (0, mappers_1.mapQuestionnaireToEncountersIds)(allResources);
    allResources.forEach(function (resource) {
        var _a;
        var appointment = resource;
        if (!(resource.resourceType === 'Appointment' && (0, helpers_2.getVideoRoomResourceExtension)(resource) && appointment.id)) {
            return;
        }
        if (!appointment.start) {
            console.log('No start time for appointment');
            return;
        }
        // add location filtering
        var apptLocationIds = (_a = appointment.participant) === null || _a === void 0 ? void 0 : _a.filter(function (part) { var _a, _b; return (_b = (_a = part.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.includes('Location/'); }).map(function (part) { var _a, _b; return (_b = (_a = part === null || part === void 0 ? void 0 : part.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1]; }).filter(utils_1.isTruthy);
        if (locationsIdsFilter && !apptLocationIds.some(function (id) { return locationsIdsFilter.includes(id); })) {
            return;
        }
        console.log('visitTypes', visitTypes);
        console.log('type in appt', appointment.appointmentType, (0, utils_1.appointmentTypeForAppointment)(appointment));
        // add visit type filtering
        if (visitTypes && visitTypes.length > 0 && !(visitTypes === null || visitTypes === void 0 ? void 0 : visitTypes.includes((0, utils_1.appointmentTypeForAppointment)(appointment)))) {
            return;
        }
        var encounter = appointmentEncounterMap[appointment.id];
        if (encounter) {
            var telemedStatus = (0, utils_1.getTelemedVisitStatus)(encounter.status, appointment.status);
            var paperwork = encounterQuestionnaireMap[encounter.id];
            if (telemedStatus && statusesFilter.includes(telemedStatus)) {
                var locationVirtual = (0, exports.findVirtualLocationForAppointment)(appointment, virtualLocationsMap);
                var practitioner = filterPractitionerForEncounter(allResources, encounter);
                if (!locationVirtual) {
                    console.error('No location for appointment', appointment.id);
                    return;
                }
                resultAppointments.push({
                    appointment: appointment,
                    paperwork: paperwork,
                    locationVirtual: locationVirtual,
                    encounter: encounter,
                    telemedStatus: telemedStatus,
                    practitioner: practitioner,
                    telemedStatusHistory: encounter.statusHistory
                        ? (0, utils_1.getTelemedEncounterStatusHistory)(encounter.statusHistory, appointment.status)
                        : [],
                });
            }
        }
    });
    return resultAppointments;
};
exports.filterAppointmentsAndCreatePackages = filterAppointmentsAndCreatePackages;
