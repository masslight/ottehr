"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
exports.validateRequestParameters = validateRequestParameters;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var mappers_1 = require("../../ehr/get-telemed-appointments/helpers/mappers");
var shared_1 = require("../../shared");
function validateRequestParameters(input) {
    return {
        secrets: input.secrets,
    };
}
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('notification-Updater', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    function addNewSMSCommunicationForPractitioner(practitioner, communication, status) {
        var notificationSettings = (0, utils_1.getProviderNotificationSettingsForPractitioner)(practitioner);
        if (notificationSettings &&
            (status === 'completed' ||
                (status === 'in-progress' && (notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.method) === utils_1.ProviderNotificationMethod['phone and computer']))) {
            addOrUpdateSMSPractitionerCommunications(communication, practitioner);
        }
    }
    function addOrUpdateSMSPractitionerCommunications(newCommunication, practitioner) {
        var _a;
        sendSMSPractitionerCommunications[practitioner.id] = {
            practitioner: practitioner,
            communications: ((_a = sendSMSPractitionerCommunications[practitioner.id]) === null || _a === void 0 ? void 0 : _a.communications)
                ? __spreadArray(__spreadArray([], sendSMSPractitionerCommunications[practitioner.id].communications, true), [newCommunication], false) : [newCommunication],
        };
    }
    var sendSMSPractitionerCommunications, busyPractitionerIds, createCommunicationRequests, updateCommunicationRequests, updateAppointmentRequests, practitionerUnsignedTooLongAppointmentPackagesMap, secrets, oystehr_1, _a, readyOrUnsignedVisitPackages_1, assignedOrInProgressVisitPackages_1, statePractitionerMap_1, allPractitionersIdMap_1, sendSMSRequests_1, requests, e_1, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                sendSMSPractitionerCommunications = {};
                busyPractitionerIds = new Set();
                createCommunicationRequests = [];
                updateCommunicationRequests = [];
                updateAppointmentRequests = [];
                practitionerUnsignedTooLongAppointmentPackagesMap = {};
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                console.group('validateRequestParameters');
                secrets = validateRequestParameters(input).secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _b.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('Created zapToken and fhir client');
                return [4 /*yield*/, Promise.all([
                        getResourcePackagesAppointmentsMap(oystehr_1, ['planned', 'finished'], 
                        // getting ready and unsigned appointments for the last 49 hours just to send appropriate notifications
                        // on unsigned appointments that are in the unsigned state for too long
                        luxon_1.DateTime.utc().minus(luxon_1.Duration.fromISO('PT49H'))),
                        getResourcePackagesAppointmentsMap(oystehr_1, ['arrived', 'in-progress'], luxon_1.DateTime.utc().minus(luxon_1.Duration.fromISO('PT24H'))),
                        getPractitionersByStatesMap(oystehr_1),
                    ])];
            case 3:
                _a = _b.sent(), readyOrUnsignedVisitPackages_1 = _a[0], assignedOrInProgressVisitPackages_1 = _a[1], statePractitionerMap_1 = _a[2];
                console.log('--- Ready or unsigned: ' + JSON.stringify(readyOrUnsignedVisitPackages_1));
                console.log('--- In progress: ' + JSON.stringify(assignedOrInProgressVisitPackages_1));
                console.log('--- States/practitioners map: ' + JSON.stringify(statePractitionerMap_1));
                allPractitionersIdMap_1 = Object.keys(statePractitionerMap_1).reduce(function (acc, val) {
                    var practitioners = statePractitionerMap_1[val].map(function (practitioner) { return practitioner; });
                    practitioners.forEach(function (currentPractitioner) {
                        acc[currentPractitioner.id] = currentPractitioner;
                    });
                    return acc;
                }, {});
                // Going through arrived or in-progress visits to determine busy practitioners that should not receive a notification
                Object.keys(assignedOrInProgressVisitPackages_1).forEach(function (appointmentId) {
                    var practitioner = assignedOrInProgressVisitPackages_1[appointmentId].practitioner;
                    if (practitioner) {
                        busyPractitionerIds.add(practitioner.id);
                    }
                });
                console.log("Busy practitioners: ".concat(JSON.stringify(busyPractitionerIds)));
                // Going through ready or unsigned visits to create notifications and other update logic
                Object.keys(readyOrUnsignedVisitPackages_1).forEach(function (appointmentId) {
                    var _a, _b, _c, _d, _e, _f, _g;
                    try {
                        var _h = readyOrUnsignedVisitPackages_1[appointmentId], appointment = _h.appointment, encounter = _h.encounter, practitioner = _h.practitioner, location_1 = _h.location, communications = _h.communications;
                        if (encounter && appointment) {
                            var status_1 = (0, utils_1.getTelemedVisitStatus)(encounter.status, appointment.status);
                            if (!status_1)
                                return;
                            // getting communications that were postponed after practitioner will become not busy
                            if ((practitioner === null || practitioner === void 0 ? void 0 : practitioner.id) && communications && !busyPractitionerIds.has(practitioner.id)) {
                                var postponedCommunications = communications.filter(function (comm) {
                                    var _a, _b;
                                    return comm.status === 'preparation' &&
                                        ((_a = comm.recipient) === null || _a === void 0 ? void 0 : _a[0].reference) &&
                                        !busyPractitionerIds.has((_b = comm.recipient) === null || _b === void 0 ? void 0 : _b[0].reference);
                                });
                                postponedCommunications.forEach(function (communication) {
                                    var communicationPractitionerUri = communication.recipient[0].reference;
                                    var practitioner = allPractitionersIdMap_1[communicationPractitionerUri];
                                    var notificationSettings = (0, utils_1.getProviderNotificationSettingsForPractitioner)(practitioner);
                                    if (notificationSettings && notificationSettings.enabled) {
                                        var newStatus = getCommunicationStatus(notificationSettings, busyPractitionerIds, practitioner);
                                        updateCommunicationRequests.push((0, utils_1.getPatchBinary)({
                                            resourceId: communication.id,
                                            resourceType: 'Communication',
                                            patchOperations: [
                                                {
                                                    op: 'replace',
                                                    path: '/status',
                                                    value: newStatus,
                                                },
                                            ],
                                        }));
                                        addNewSMSCommunicationForPractitioner(practitioner, communication, newStatus);
                                    }
                                });
                            }
                            if (status_1 === utils_1.TelemedAppointmentStatusEnum.ready) {
                                // check the tag presence that indicates that communications for "Patient is waiting" notification already exist
                                var isProcessed = (_b = (_a = appointment.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) {
                                    return tag.system === utils_1.PROVIDER_NOTIFICATION_TAG_SYSTEM &&
                                        tag.code === utils_1.AppointmentProviderNotificationTags.patient_waiting;
                                });
                                if (!isProcessed && ((_c = location_1 === null || location_1 === void 0 ? void 0 : location_1.address) === null || _c === void 0 ? void 0 : _c.state)) {
                                    // add tag into appointment and add to batch request
                                    updateAppointmentRequests.push((0, utils_1.getPatchBinary)({
                                        resourceId: appointment.id,
                                        resourceType: 'Appointment',
                                        patchOperations: [
                                            (0, utils_1.getPatchOperationForNewMetaTag)(appointment, {
                                                system: utils_1.PROVIDER_NOTIFICATION_TAG_SYSTEM,
                                                code: utils_1.AppointmentProviderNotificationTags.patient_waiting,
                                            }),
                                        ],
                                    }));
                                    var providersToSendNotificationTo = statePractitionerMap_1[(_d = location_1.address) === null || _d === void 0 ? void 0 : _d.state];
                                    if (providersToSendNotificationTo) {
                                        for (var _i = 0, providersToSendNotificationTo_1 = providersToSendNotificationTo; _i < providersToSendNotificationTo_1.length; _i++) {
                                            var provider = providersToSendNotificationTo_1[_i];
                                            var notificationSettings = (0, utils_1.getProviderNotificationSettingsForPractitioner)(provider);
                                            // - if practitioner has notifications disabled - we don't create notification at all
                                            if (notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.enabled) {
                                                var status_2 = getCommunicationStatus(notificationSettings, busyPractitionerIds, provider);
                                                var request = {
                                                    method: 'POST',
                                                    url: '/Communication',
                                                    resource: {
                                                        resourceType: 'Communication',
                                                        category: [
                                                            {
                                                                coding: [
                                                                    {
                                                                        system: utils_1.PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                                                                        code: utils_1.AppointmentProviderNotificationTypes.patient_waiting,
                                                                    },
                                                                ],
                                                            },
                                                        ],
                                                        sent: luxon_1.DateTime.utc().toISO(),
                                                        // set status to "preparation" for practitioners that should not receive notifications right now
                                                        // and "in-progress" to those who should receive it right away
                                                        status: status_2,
                                                        encounter: { reference: "Encounter/".concat(encounter.id) },
                                                        recipient: [{ reference: "Practitioner/".concat(provider.id) }],
                                                        payload: [{ contentString: "New patient in ".concat(location_1.address.state, " is waiting") }],
                                                    },
                                                };
                                                createCommunicationRequests.push(request);
                                                addNewSMSCommunicationForPractitioner(provider, request.resource, status_2);
                                            }
                                        }
                                    }
                                }
                                // todo: go through communications and make sure everything was sent
                            }
                            else if (status_1 === utils_1.TelemedAppointmentStatusEnum.unsigned && practitioner) {
                                // check that the appointment is more than >12 hours in the "unsigned" status
                                // and that corresponding notifications were sent to providers
                                var lastUnsignedStatus = (_e = encounter.statusHistory) === null || _e === void 0 ? void 0 : _e.reduceRight(function (found, entry) {
                                    if (found === null && entry.status === 'finished') {
                                        return entry;
                                    }
                                    return found;
                                }, null);
                                var utcNow = luxon_1.DateTime.utc();
                                var isProcessed = true;
                                var tagToLookFor_1 = undefined;
                                // here we check that the appointment is in the unsigned status for > 12, 24 or 48 hours
                                if (lastUnsignedStatus && !lastUnsignedStatus.period.end) {
                                    var unsignedPeriodStart = luxon_1.DateTime.fromISO(lastUnsignedStatus.period.start || utcNow.toISO());
                                    if (unsignedPeriodStart < utcNow.minus({ hour: 48 })) {
                                        tagToLookFor_1 = utils_1.AppointmentProviderNotificationTags.unsigned_more_than_x_hours_3;
                                    }
                                    else if (unsignedPeriodStart < utcNow.minus({ hour: 24 })) {
                                        tagToLookFor_1 = utils_1.AppointmentProviderNotificationTags.unsigned_more_than_x_hours_2;
                                    }
                                    else if (unsignedPeriodStart < utcNow.minus({ hour: 12 })) {
                                        tagToLookFor_1 = utils_1.AppointmentProviderNotificationTags.unsigned_more_than_x_hours_1;
                                    }
                                }
                                if (tagToLookFor_1) {
                                    isProcessed = Boolean((_g = (_f = appointment.meta) === null || _f === void 0 ? void 0 : _f.tag) === null || _g === void 0 ? void 0 : _g.find(function (tag) { return tag.system === utils_1.PROVIDER_NOTIFICATION_TAG_SYSTEM && tag.code === tagToLookFor_1; }));
                                    if (!practitionerUnsignedTooLongAppointmentPackagesMap[practitioner.id]) {
                                        practitionerUnsignedTooLongAppointmentPackagesMap[practitioner.id] = [];
                                    }
                                    practitionerUnsignedTooLongAppointmentPackagesMap[practitioner.id].push({
                                        pack: readyOrUnsignedVisitPackages_1[appointmentId],
                                        isProcessed: Boolean(isProcessed),
                                    });
                                    if (!isProcessed) {
                                        // add tag into appointment that the >x hours unsigned status notification was processed
                                        // and add to batch request
                                        updateAppointmentRequests.push((0, utils_1.getPatchBinary)({
                                            resourceId: appointment.id,
                                            resourceType: 'Appointment',
                                            patchOperations: [
                                                (0, utils_1.getPatchOperationForNewMetaTag)(appointment, {
                                                    system: utils_1.PROVIDER_NOTIFICATION_TAG_SYSTEM,
                                                    code: tagToLookFor_1,
                                                }),
                                            ],
                                        }));
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error("Error trying to process notifications for appointment ".concat(appointmentId), error);
                        (0, aws_serverless_1.captureException)(error);
                    }
                });
                console.log("Too long unsigned appointments: ".concat(JSON.stringify(practitionerUnsignedTooLongAppointmentPackagesMap)));
                Object.keys(practitionerUnsignedTooLongAppointmentPackagesMap).forEach(function (practitionerId) {
                    var _a, _b;
                    var unsignedPractitionerAppointments = practitionerUnsignedTooLongAppointmentPackagesMap[practitionerId];
                    var hasUnprocessed = false;
                    var practitionerResource = undefined;
                    var encounterResource = undefined;
                    for (var _i = 0, unsignedPractitionerAppointments_1 = unsignedPractitionerAppointments; _i < unsignedPractitionerAppointments_1.length; _i++) {
                        var appt = unsignedPractitionerAppointments_1[_i];
                        var pack = appt.pack, isProcessed = appt.isProcessed;
                        var practitioner = pack.practitioner, encounter = pack.encounter;
                        if (!practitionerResource && practitioner) {
                            practitionerResource = practitioner;
                        }
                        if (!encounterResource && encounter) {
                            encounterResource = encounter;
                        }
                        if (!isProcessed) {
                            hasUnprocessed = true;
                        }
                    }
                    if (hasUnprocessed && checkPractitionerResourceDefined(practitionerResource)) {
                        // create notification for practitioner that was assigned to this visit
                        var notificationSettings = (0, utils_1.getProviderNotificationSettingsForPractitioner)(practitionerResource);
                        // rules of status described above
                        if (notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.enabled) {
                            var unsignedChartsMessage = function (length) {
                                return "You have ".concat(length, " unsigned charts on Ottehr. Please complete and sign ASAP. Thanks!");
                            };
                            var status_3 = getCommunicationStatus(notificationSettings, busyPractitionerIds, practitionerResource);
                            var request = {
                                method: 'POST',
                                url: '/Communication',
                                resource: {
                                    resourceType: 'Communication',
                                    category: [
                                        {
                                            coding: [
                                                {
                                                    system: utils_1.PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                                                    code: utils_1.AppointmentProviderNotificationTypes.unsigned_charts,
                                                },
                                            ],
                                        },
                                    ],
                                    sent: luxon_1.DateTime.utc().toISO(),
                                    // set status to "preparation" for practitioners that should not receive notifications right now
                                    // and "in-progress" to those who should receive it right away
                                    status: status_3,
                                    encounter: encounterResource
                                        ? {
                                            reference: "Encounter/".concat(encounterResource.id),
                                        }
                                        : undefined,
                                    recipient: [{ reference: "Practitioner/".concat(practitionerResource.id) }],
                                    payload: [
                                        {
                                            contentString: unsignedChartsMessage(unsignedPractitionerAppointments.length),
                                        },
                                    ],
                                },
                            };
                            createCommunicationRequests.push(request);
                            if (status_3 === 'completed' ||
                                (status_3 === 'in-progress' &&
                                    notificationSettings.method === utils_1.ProviderNotificationMethod['phone and computer'])) {
                                // not to send multiple notifications of the same "Unsigned charts" type by sms one by one - check if theres any and update
                                var existingUnsignedNotificationPending = (_a = sendSMSPractitionerCommunications[practitionerResource.id]) === null || _a === void 0 ? void 0 : _a.communications.find(function (comm) {
                                    var _a, _b, _c, _d;
                                    return ((_b = (_a = comm.category) === null || _a === void 0 ? void 0 : _a[0].coding) === null || _b === void 0 ? void 0 : _b[0].system) === utils_1.PROVIDER_NOTIFICATION_TYPE_SYSTEM &&
                                        ((_d = (_c = comm.category) === null || _c === void 0 ? void 0 : _c[0].coding) === null || _d === void 0 ? void 0 : _d[0].code) === utils_1.AppointmentProviderNotificationTypes.unsigned_charts;
                                });
                                if ((_b = existingUnsignedNotificationPending === null || existingUnsignedNotificationPending === void 0 ? void 0 : existingUnsignedNotificationPending.payload) === null || _b === void 0 ? void 0 : _b[0]) {
                                    existingUnsignedNotificationPending.payload[0].contentString = unsignedChartsMessage(unsignedPractitionerAppointments.length);
                                }
                                else {
                                    addOrUpdateSMSPractitionerCommunications(request.resource, practitionerResource);
                                }
                            }
                        }
                    }
                });
                sendSMSRequests_1 = [];
                Object.keys(sendSMSPractitionerCommunications).forEach(function (id) {
                    var _a;
                    try {
                        var _b = sendSMSPractitionerCommunications[id], practitioner_1 = _b.practitioner, communications = _b.communications;
                        var notificationSettings = (0, utils_1.getProviderNotificationSettingsForPractitioner)(practitioner_1);
                        if ((((_a = practitioner_1.telecom) === null || _a === void 0 ? void 0 : _a.find(function (tel) { return tel.system === 'sms' && Boolean(tel.value); })) &&
                            (notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.method) === utils_1.ProviderNotificationMethod.phone) ||
                            (notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.method) === utils_1.ProviderNotificationMethod['phone and computer']) {
                            communications.forEach(function (comm) {
                                var _a, _b;
                                if ((_a = comm.payload) === null || _a === void 0 ? void 0 : _a[0].contentString) {
                                    sendSMSRequests_1.push(oystehr_1.transactionalSMS.send({
                                        resource: "Practitioner/".concat(practitioner_1.id),
                                        message: (_b = comm.payload) === null || _b === void 0 ? void 0 : _b[0].contentString,
                                    }));
                                }
                            });
                        }
                    }
                    catch (error) {
                        console.error("Error trying to send SMS notifications for practitioner ".concat(sendSMSPractitionerCommunications[id].practitioner.id), error);
                        (0, aws_serverless_1.captureException)(error);
                    }
                });
                console.log("Update appointment requests: ".concat(JSON.stringify(updateAppointmentRequests)));
                console.log("Create communications requests: ".concat(JSON.stringify(createCommunicationRequests)));
                _b.label = 4;
            case 4:
                _b.trys.push([4, 6, , 7]);
                requests = [];
                if (updateAppointmentRequests.length > 0 ||
                    createCommunicationRequests.length > 0 ||
                    updateCommunicationRequests.length > 0) {
                    requests.push(oystehr_1.fhir.transaction({
                        requests: __spreadArray(__spreadArray(__spreadArray([], updateAppointmentRequests, true), createCommunicationRequests, true), updateCommunicationRequests, true),
                    }));
                }
                if (sendSMSRequests_1.length > 0) {
                    requests.push.apply(requests, sendSMSRequests_1);
                }
                return [4 /*yield*/, Promise.all(__spreadArray([], requests, true))];
            case 5:
                _b.sent();
                return [3 /*break*/, 7];
            case 6:
                e_1 = _b.sent();
                console.log('Error trying to create/update notifications related resources, or send sms notifications', JSON.stringify(e_1));
                throw e_1;
            case 7: return [2 /*return*/, {
                    statusCode: 200,
                    body: 'Successfully processed provider notifications',
                }];
            case 8:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)('Notification-updater', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
function checkPractitionerResourceDefined(resource) {
    return resource !== undefined;
}
/** Getting appointments with status "Arrived" and encounter with statuses
 * that correspond to Telemed statuses "ready", "pre-video", "on-video", "unsigned".
 * Include related encounter, patient, provider and communication
 */
function getResourcePackagesAppointmentsMap(oystehr, statuses, fromDate) {
    return __awaiter(this, void 0, void 0, function () {
        var results, getOrCreateAppointmentResourcePackage, encounterIdAppointmentIdMap, resourcePackagesMap, practitionerIdMap, locationIdMap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: '_tag', value: utils_1.OTTEHR_MODULE.TM },
                            {
                                name: 'date',
                                value: "ge".concat(fromDate),
                            },
                            {
                                name: 'status',
                                value: "arrived",
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Encounter:participant:Practitioner',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Communication:encounter',
                            },
                            {
                                name: '_has:Encounter:appointment:status',
                                value: statuses.join(','),
                            },
                        ],
                    })];
                case 1:
                    results = (_a.sent()).unbundle();
                    getOrCreateAppointmentResourcePackage = function (appointmentId) {
                        if (!resourcePackagesMap[appointmentId]) {
                            resourcePackagesMap[appointmentId] = {
                                communications: [],
                            };
                        }
                        return __assign({}, resourcePackagesMap[appointmentId]);
                    };
                    encounterIdAppointmentIdMap = {};
                    resourcePackagesMap = {};
                    practitionerIdMap = {};
                    locationIdMap = {};
                    // first fill maps with Appointments and Encounters
                    results.forEach(function (res) {
                        if (res.resourceType === 'Encounter') {
                            var encounter = res;
                            var appointmentId = (0, mappers_1.getTelemedEncounterAppointmentId)(encounter);
                            if (appointmentId) {
                                var pack = getOrCreateAppointmentResourcePackage(appointmentId);
                                pack.encounter = encounter;
                                resourcePackagesMap[appointmentId] = pack;
                                encounterIdAppointmentIdMap[encounter.id] = appointmentId;
                            }
                        }
                        else if (res.resourceType === 'Appointment') {
                            var appointment = res;
                            var pack = getOrCreateAppointmentResourcePackage(appointment.id);
                            pack.appointment = appointment;
                            resourcePackagesMap[appointment.id] = pack;
                        }
                        else if (res.resourceType === 'Practitioner') {
                            // create practitioners id map for later optimized mapping
                            var practitioner = res;
                            practitionerIdMap[practitioner.id] = practitioner;
                        }
                        else if (res.resourceType === 'Location') {
                            // create locations id map for later optimized mapping
                            var location_2 = res;
                            locationIdMap[location_2.id] = location_2;
                        }
                    });
                    results.forEach(function (res) {
                        // fill in communications (it needs already some filled in maps)
                        if (res.resourceType === 'Communication') {
                            var communication = res;
                            var encounterReference = communication.encounter.reference;
                            var encounterId = (0, utils_1.removePrefix)('Encounter/', encounterReference);
                            var appointmentId = encounterIdAppointmentIdMap[encounterId];
                            var pack = getOrCreateAppointmentResourcePackage(appointmentId);
                            pack.communications.push(communication);
                            resourcePackagesMap[appointmentId] = pack;
                        }
                    });
                    // fill in practitioners and locations
                    Object.keys(resourcePackagesMap).forEach(function (appointmentId) {
                        var _a, _b, _c, _d, _e;
                        var encounter = resourcePackagesMap[appointmentId].encounter;
                        var practitionerReference = (_c = (_b = (_a = encounter === null || encounter === void 0 ? void 0 : encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (participant) { var _a, _b; return (_b = (_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Practitioner'); })) === null || _b === void 0 ? void 0 : _b.individual) === null || _c === void 0 ? void 0 : _c.reference;
                        if (practitionerReference) {
                            var practitionerId = (0, utils_1.removePrefix)('Practitioner/', practitionerReference);
                            if (practitionerId) {
                                var pack = getOrCreateAppointmentResourcePackage(appointmentId);
                                pack.practitioner = practitionerIdMap[practitionerId];
                                resourcePackagesMap[appointmentId] = pack;
                            }
                        }
                        var locationReference = (_e = (_d = encounter === null || encounter === void 0 ? void 0 : encounter.location) === null || _d === void 0 ? void 0 : _d.find(function (loc) { return loc.location.reference; })) === null || _e === void 0 ? void 0 : _e.location.reference;
                        if (locationReference) {
                            var locationId = (0, utils_1.removePrefix)('Location/', locationReference);
                            if (locationId) {
                                var pack = getOrCreateAppointmentResourcePackage(appointmentId);
                                pack.location = locationIdMap[locationId];
                                resourcePackagesMap[appointmentId] = pack;
                            }
                        }
                    });
                    return [2 /*return*/, resourcePackagesMap];
            }
        });
    });
}
var getPractitionersByStatesMap = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, employees, roles, _b, _c, _d, inactiveRoleId, providerRoleId, practitionerIds, _e, inactiveRoleMembers, providerRoleMembers, practitionerResources, inactiveUsersMap, providerUsersMap, userIdPractitionerMap, _loop_1, _i, _f, entry, statePractitionerMap;
    var _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                _c = (_b = Promise).all;
                return [4 /*yield*/, (0, shared_1.getEmployees)(oystehr)];
            case 1:
                _d = [_j.sent()];
                return [4 /*yield*/, (0, shared_1.getRoles)(oystehr)];
            case 2: return [4 /*yield*/, _c.apply(_b, [_d.concat([_j.sent()])])];
            case 3:
                _a = _j.sent(), employees = _a[0], roles = _a[1];
                inactiveRoleId = (_g = roles.find(function (role) { return role.name === utils_1.RoleType.Inactive; })) === null || _g === void 0 ? void 0 : _g.id;
                providerRoleId = (_h = roles.find(function (role) { return role.name === utils_1.RoleType.Provider; })) === null || _h === void 0 ? void 0 : _h.id;
                if (!inactiveRoleId || !providerRoleId) {
                    throw new Error('Error searching for Inactive or Provider role.');
                }
                console.log('Preparing the FHIR batch request.');
                practitionerIds = employees.map(function (employee) { return employee.profile.split('/')[1]; });
                return [4 /*yield*/, Promise.all([
                        (0, shared_1.getRoleMembers)(inactiveRoleId, oystehr),
                        (0, shared_1.getRoleMembers)(providerRoleId, oystehr),
                        oystehr.fhir.search({
                            resourceType: 'Practitioner',
                            params: [
                                {
                                    name: '_id',
                                    value: practitionerIds.join(','),
                                },
                            ],
                        }),
                    ])];
            case 4:
                _e = _j.sent(), inactiveRoleMembers = _e[0], providerRoleMembers = _e[1], practitionerResources = _e[2];
                console.log("Fetched ".concat(inactiveRoleMembers.length, " Inactive and ").concat(providerRoleMembers.length, " Provider role members."));
                console.log("provider roles members: ".concat(JSON.stringify(providerRoleMembers)));
                inactiveUsersMap = new Map(inactiveRoleMembers.map(function (user) { return [user.id, user]; }));
                providerUsersMap = new Map(providerRoleMembers.map(function (user) { return [user.id, user]; }));
                userIdPractitionerMap = {};
                _loop_1 = function (entry) {
                    var userId = entry[0], user = entry[1];
                    var practitionerId = (0, utils_1.removePrefix)('Practitioner/', user.profile || '');
                    if (!practitionerId)
                        return "continue";
                    var practitioner = practitionerResources.unbundle().find(function (res) { return res.id === practitionerId; });
                    if (practitioner) {
                        userIdPractitionerMap[userId] = practitioner;
                    }
                };
                for (_i = 0, _f = providerUsersMap.entries(); _i < _f.length; _i++) {
                    entry = _f[_i];
                    _loop_1(entry);
                }
                statePractitionerMap = {};
                employees.forEach(function (employee) {
                    var isActive = !inactiveUsersMap.has(employee.id);
                    var isProvider = providerUsersMap.has(employee.id);
                    if (!isActive || !isProvider) {
                        return;
                    }
                    var practitioner = userIdPractitionerMap[employee.id];
                    var licenses = (0, utils_1.allLicensesForPractitioner)(practitioner);
                    licenses.forEach(function (license) {
                        addPractitionerToState(statePractitionerMap, license.state, practitioner);
                    });
                });
                return [2 /*return*/, statePractitionerMap];
        }
    });
}); };
function addPractitionerToState(statesPractitionersMap, state, practitioner) {
    if (!statesPractitionersMap[state]) {
        statesPractitionersMap[state] = [];
    }
    statesPractitionersMap[state].push(practitioner);
}
// set the status of communication:
// - if practitioner is not busy and notifications enabled - set it to in-progress
// - if practitioner is busy - set it to "preparation"
// - if provider has only "mobile" notification type - we can set the status to "completed" and
// send the notification to mobile right away
function getCommunicationStatus(notificationSettings, busyPractitionerIds, practitioner) {
    var status = 'in-progress';
    if (busyPractitionerIds.has((practitioner === null || practitioner === void 0 ? void 0 : practitioner.id) || '')) {
        status = 'preparation';
    }
    else if (notificationSettings.method === utils_1.ProviderNotificationMethod.phone) {
        status = 'completed';
    }
    return status;
}
