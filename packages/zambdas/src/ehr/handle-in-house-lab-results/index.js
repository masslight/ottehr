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
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var labs_results_form_pdf_1 = require("../../shared/pdf/labs-results-form-pdf");
var tasks_1 = require("../../shared/tasks");
var in_house_labs_1 = require("../shared/in-house-labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'handle-in-house-lab-results';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, serviceRequestId, resultsEntryData, secrets, userToken, oystehr, oystehrCurrentUser, curUserPractitionerId, _b, serviceRequest, encounter, patient, inputResultTask, specimen, activityDefinition, currentUserPractitioner, attendingPractitioner, schedule, location_1, relatedServiceRequests, currentUserPractitionerName, attendingPractitionerName, requests, res, diagnosticReport_1, updatedInputResultTask_1, observations_1, e_1, response, error_1, ENVIRONMENT;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 9, , 10]);
                console.log("handle-in-house-lab-results started, input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), serviceRequestId = _a.serviceRequestId, resultsEntryData = _a.data, secrets = _a.secrets, userToken = _a.userToken;
                console.log('validateRequestParameters success');
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _d.sent();
                console.log('token', m2mToken);
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 2:
                curUserPractitionerId = _d.sent();
                return [4 /*yield*/, getInHouseLabResultResources(serviceRequestId, curUserPractitionerId, oystehr)];
            case 3:
                _b = _d.sent(), serviceRequest = _b.serviceRequest, encounter = _b.encounter, patient = _b.patient, inputResultTask = _b.inputResultTask, specimen = _b.specimen, activityDefinition = _b.activityDefinition, currentUserPractitioner = _b.currentUserPractitioner, attendingPractitioner = _b.attendingPractitioner, schedule = _b.schedule, location_1 = _b.location, relatedServiceRequests = _b.relatedServiceRequests;
                currentUserPractitionerName = (0, utils_1.getFullestAvailableName)(currentUserPractitioner);
                attendingPractitionerName = (0, utils_1.getFullestAvailableName)(attendingPractitioner);
                requests = makeResultEntryRequests(serviceRequest, inputResultTask, specimen, activityDefinition, resultsEntryData, { id: curUserPractitionerId, name: currentUserPractitionerName }, { id: attendingPractitioner.id || '', name: attendingPractitionerName }, relatedServiceRequests);
                console.log("These are the fhir requests getting made: ".concat(JSON.stringify(requests)));
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 4:
                res = _d.sent();
                console.log('check the res', JSON.stringify(res));
                observations_1 = [];
                (_c = res.entry) === null || _c === void 0 ? void 0 : _c.forEach(function (entry) {
                    var _a, _b, _c, _d, _e;
                    if (((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'DiagnosticReport') {
                        diagnosticReport_1 = entry.resource;
                    }
                    if (((_b = entry.resource) === null || _b === void 0 ? void 0 : _b.resourceType) === 'Task') {
                        var task = entry.resource;
                        if ((_d = (_c = task.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.some(function (c) { return c.code === utils_1.IN_HOUSE_LAB_TASK.code.inputResultsTask; })) {
                            updatedInputResultTask_1 = task;
                        }
                    }
                    if (((_e = entry.resource) === null || _e === void 0 ? void 0 : _e.resourceType) === 'Observation') {
                        observations_1.push(entry.resource);
                    }
                });
                if (!diagnosticReport_1)
                    throw new Error("There was an issue creating and/or parsing the diagnostic report for this service request: ".concat(serviceRequest.id));
                if (!updatedInputResultTask_1)
                    throw new Error("There was an issue updating and/or parsing the input result task for this service request: ".concat(serviceRequest.id));
                if (!observations_1.length) {
                    throw new Error("There was an issue creating and/or parsing the observations task for this service request: ".concat(serviceRequest.id));
                }
                _d.label = 5;
            case 5:
                _d.trys.push([5, 7, , 8]);
                return [4 /*yield*/, (0, labs_results_form_pdf_1.createInHouseLabResultPDF)(oystehr, serviceRequest, encounter, patient, location_1, schedule, attendingPractitioner, attendingPractitionerName, updatedInputResultTask_1, observations_1, diagnosticReport_1, secrets, m2mToken, activityDefinition, relatedServiceRequests, specimen)];
            case 6:
                _d.sent();
                return [3 /*break*/, 8];
            case 7:
                e_1 = _d.sent();
                console.log('there was an error creating the result pdf for this service request', serviceRequest.id);
                console.log('error:', e_1, JSON.stringify(e_1));
                return [3 /*break*/, 8];
            case 8:
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 9:
                error_1 = _d.sent();
                console.error('Error handling in-house lab results:', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('handle-in-house-lab-results', error_1, ENVIRONMENT)];
            case 10: return [2 /*return*/];
        }
    });
}); });
// todo better errors
var getInHouseLabResultResources = function (serviceRequestId, curUserPractitionerId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var labOrderResources, serviceRequests, patients, inputResultTasks, specimens, encounters, schedules, locations, serviceRequest, inputResultTask, relatedServiceRequests, patient, encounter, attendingPractitionerId, schedule, location, _a, adUrl, version, _b, currentUserPractitioner, attendingPractitioner, activityDefinitionSearch, activityDefinitions;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'ServiceRequest',
                    params: [
                        {
                            name: '_id',
                            value: serviceRequestId,
                        },
                        {
                            name: '_include',
                            value: 'ServiceRequest:encounter',
                        },
                        {
                            name: '_revinclude',
                            value: 'Task:based-on',
                        },
                        {
                            name: '_include',
                            value: 'ServiceRequest:specimen',
                        },
                        {
                            name: '_include',
                            value: 'ServiceRequest:patient',
                        },
                        { name: '_include:iterate', value: 'Encounter:location' },
                        {
                            name: '_include:iterate',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:slot',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Slot:schedule',
                        },
                        // Include any related repeat test SRs
                        {
                            name: '_include:iterate',
                            value: 'ServiceRequest:based-on',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ServiceRequest:based-on',
                        },
                    ],
                })];
            case 1:
                labOrderResources = (_c.sent()).unbundle();
                console.log('labOrderResources', JSON.stringify(labOrderResources));
                serviceRequests = [];
                patients = [];
                inputResultTasks = [];
                specimens = [];
                encounters = [];
                schedules = [];
                locations = [];
                labOrderResources.forEach(function (resource) {
                    var _a, _b;
                    if (resource.resourceType === 'ServiceRequest')
                        serviceRequests.push(resource);
                    if (resource.resourceType === 'Patient')
                        patients.push(resource);
                    if (resource.resourceType === 'Specimen')
                        specimens.push(resource);
                    if (resource.resourceType === 'Encounter')
                        encounters.push(resource);
                    if (resource.resourceType === 'Schedule')
                        schedules.push(resource);
                    if (resource.resourceType === 'Location')
                        locations.push(resource);
                    if (resource.resourceType === 'Task' &&
                        ((_b = (_a = resource.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.code === utils_1.IN_HOUSE_LAB_TASK.code.inputResultsTask; }))) {
                        inputResultTasks.push(resource);
                    }
                });
                serviceRequest = serviceRequests.find(function (sr) { return sr.id === serviceRequestId; });
                if (!serviceRequest)
                    throw new Error("service request not found for id ".concat(serviceRequestId));
                if (patients.length !== 1)
                    throw new Error('Only one patient should be returned');
                if (encounters.length !== 1)
                    throw new Error('Only one encounter should be returned');
                if (specimens.length !== 1)
                    throw new Error("Only one specimen should be returned - specimen ids: ".concat(specimens.map(function (s) { return s.id; })));
                console.log('These are the inputResultTasks', JSON.stringify(inputResultTasks));
                if (inputResultTasks.length !== 1) {
                    console.log('inputResultTasks', inputResultTasks);
                    throw new Error("Found multiple IRT tasks for ServiceRequest/".concat(serviceRequestId, ". Expected one"));
                }
                inputResultTask = inputResultTasks[0];
                if (inputResultTask.status === 'completed') {
                    throw new Error('Result has already been entered. Refresh the page to continue.');
                }
                if (inputResultTask.status !== 'ready' && inputResultTask.status !== 'in-progress') {
                    throw new Error("One ready or in-progress IRT task should exist for ServiceRequest/".concat(serviceRequestId));
                }
                relatedServiceRequests = serviceRequests.length > 1 ? (0, in_house_labs_1.getRelatedServiceRequests)(serviceRequests, serviceRequestId) : undefined;
                console.log('relatedServiceRequests ids ', relatedServiceRequests === null || relatedServiceRequests === void 0 ? void 0 : relatedServiceRequests.map(function (sr) { return sr.id; }));
                patient = patients[0];
                encounter = encounters[0];
                attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                if (!attendingPractitionerId)
                    throw Error('Attending practitioner not found');
                schedule = schedules[0];
                location = locations.length ? locations[0] : undefined;
                _a = (0, in_house_labs_1.getUrlAndVersionForADFromServiceRequest)(serviceRequest), adUrl = _a.url, version = _a.version;
                return [4 /*yield*/, Promise.all([
                        oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: curUserPractitionerId,
                        }),
                        oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: attendingPractitionerId,
                        }),
                        // todo there's a bug with _include=ServiceRequest:instantiates-canonical
                        // so doing this for now
                        oystehr.fhir.search({
                            resourceType: 'ActivityDefinition',
                            params: [
                                {
                                    name: 'url',
                                    value: adUrl,
                                },
                                { name: 'version', value: version },
                            ],
                        }),
                    ])];
            case 2:
                _b = _c.sent(), currentUserPractitioner = _b[0], attendingPractitioner = _b[1], activityDefinitionSearch = _b[2];
                activityDefinitions = activityDefinitionSearch.unbundle();
                if (activityDefinitions.length !== 1)
                    throw new Error('Only one activity definition should be returned');
                return [2 /*return*/, {
                        serviceRequest: serviceRequest,
                        encounter: encounter,
                        patient: patient,
                        inputResultTask: inputResultTask,
                        specimen: specimens[0],
                        activityDefinition: activityDefinitions[0],
                        currentUserPractitioner: currentUserPractitioner,
                        attendingPractitioner: attendingPractitioner,
                        location: location,
                        schedule: schedule,
                        relatedServiceRequests: relatedServiceRequests,
                    }];
        }
    });
}); };
var makeResultEntryRequests = function (serviceRequest, irtTask, specimen, activityDefinition, resultsEntryData, curUser, attendingPractitioner, relatedServiceRequests) {
    var _a, _b, _c, _d, _e, _f;
    var requests = [];
    var serviceRequestPatchOperations = [
        {
            path: '/status',
            op: 'replace',
            value: 'completed',
        },
    ];
    var _g = makeProvenancePostRequest(serviceRequest.id || '', curUser, attendingPractitioner), provenancePostRequest = _g.provenancePostRequest, provenanceFullUrl = _g.provenanceFullUrl;
    requests.push(provenancePostRequest);
    var irtTaskPatchRequest = makeIrtTaskPatchRequest(irtTask, provenanceFullUrl, curUser);
    requests.push(irtTaskPatchRequest);
    var _h = makeObservationPostRequests(serviceRequest, specimen, activityDefinition, curUser, resultsEntryData), obsRefs = _h.obsRefs, obsPostRequests = _h.obsPostRequests, nonNormalResultRecorded = _h.nonNormalResultRecorded, reflexTestTriggered = _h.reflexTestTriggered;
    requests.push.apply(requests, obsPostRequests);
    var diagnosticReportPostRequest = makeDiagnosticReportPostRequest(serviceRequest, activityDefinition, obsRefs, nonNormalResultRecorded, reflexTestTriggered);
    requests.push(diagnosticReportPostRequest);
    var isReflex = (0, utils_1.activityDefinitionIsReflexTest)(activityDefinition);
    if (isReflex && reflexTestTriggered) {
        throw new Error("this test somehow is both triggering a reflex test and is a reflex test, we are not equipped to handle: ServiceRequest/".concat(serviceRequest.id));
    }
    if (reflexTestTriggered) {
        console.log("reflexTestTriggered, we need to add pending reflex test tag to ServiceRequest/".concat(serviceRequest.id));
        // if we make it here it would be very odd for this ext.valueString to not be found
        var testName = (_c = (_b = (_a = reflexTestTriggered.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.REFLEX_TEST_TO_RUN_NAME_URL; })) === null || _b === void 0 ? void 0 : _b.valueString) !== null && _c !== void 0 ? _c : 'reflex test';
        // tagging the service request so that we can validate signing the progress note
        // if a reflex test has been triggered progress note cannot be signed until the reflex test is created and results are inputted
        var serviceRequestTagPatchOps = (0, utils_1.getPatchOperationsForNewMetaTags)(serviceRequest, [
            {
                system: utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
                code: utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending,
                display: testName,
            },
        ]);
        serviceRequestPatchOperations.push.apply(serviceRequestPatchOperations, serviceRequestTagPatchOps);
    }
    else if (isReflex) {
        // need to remove the reflex test pending tag from the parent SR so the user can sign progress note
        console.log('Results are being entered for a reflex test, we need to remove the pending test tag from the parent ServiceRequest, searching for it now');
        var parentServiceRequestId_1 = (_f = (_e = (_d = serviceRequest.basedOn) === null || _d === void 0 ? void 0 : _d.find(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.replace('ServiceRequest/', '');
        var parentServiceRequest = relatedServiceRequests === null || relatedServiceRequests === void 0 ? void 0 : relatedServiceRequests.find(function (sr) { return sr.id === parentServiceRequestId_1; });
        if (parentServiceRequest) {
            console.log("found a parent test, ServiceRequest/".concat(parentServiceRequest.id));
            // remove the reflex-test-tag on the parent test service request
            var parentTestServiceRequestTagPatch = {
                method: 'PATCH',
                url: "ServiceRequest/".concat(parentServiceRequest.id),
                operations: [
                    (0, utils_1.getPatchOperationToRemoveMetaTags)(parentServiceRequest, [
                        {
                            system: utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
                            code: utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending,
                        },
                    ]),
                ],
            };
            requests.push(parentTestServiceRequestTagPatch);
        }
    }
    var serviceRequestPatchRequest = {
        method: 'PATCH',
        url: "ServiceRequest/".concat(serviceRequest.id),
        operations: serviceRequestPatchOperations,
    };
    requests.push(serviceRequestPatchRequest);
    return requests;
};
var makeObservationPostRequests = function (serviceRequest, specimen, activityDefinition, curUser, resultsEntryData) {
    if (!activityDefinition.code)
        throw new Error('activityDefinition.code is missing and is required');
    var activityDefContained = activityDefinition.contained;
    if (!activityDefContained)
        throw new Error('activityDefinition.contained is missing and is required');
    var obsConfig = {
        resourceType: 'Observation',
        basedOn: [
            {
                reference: "ServiceRequest/".concat(serviceRequest.id),
            },
        ],
        encounter: serviceRequest.encounter,
        status: 'final',
        subject: serviceRequest.subject,
        specimen: {
            reference: "Specimen/".concat(specimen.id),
        },
        performer: [
            {
                reference: "Practitioner/".concat(curUser.id),
                display: curUser.name,
            },
        ],
        code: activityDefinition.code,
    };
    var obsRefs = [];
    var obsPostRequests = [];
    var nonNormalResultRecorded = [];
    var reflexTestTriggered;
    Object.keys(resultsEntryData).forEach(function (observationDefinitionId) {
        var _a, _b;
        var entry = resultsEntryData[observationDefinitionId];
        var obsFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
        var obsDef = getObsDefFromActivityDef(observationDefinitionId, activityDefContained);
        obsRefs.push({
            reference: obsFullUrl,
        });
        var _c = formatObsValueAndInterpretation(entry, obsDef, activityDefContained), obsValue = _c.obsValue, obsInterpretation = _c.obsInterpretation, nonNormalResult = _c.nonNormalResult;
        if (nonNormalResult) {
            console.log('flagging non-normal result for', (_b = (_a = activityDefinition.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.map(function (coding) { return coding.code; }));
            nonNormalResultRecorded.push(nonNormalResult);
        }
        var obsFinalConfig = __assign(__assign(__assign(__assign({}, obsConfig), obsValue), obsInterpretation), { extension: [
                {
                    url: utils_1.IN_HOUSE_OBS_DEF_ID_SYSTEM,
                    valueString: observationDefinitionId,
                },
            ] });
        reflexTestTriggered = (0, utils_1.checkIfReflexIsTriggered)(activityDefinition, obsFinalConfig);
        var request = {
            method: 'POST',
            fullUrl: obsFullUrl,
            url: '/Observation',
            resource: obsFinalConfig,
        };
        obsPostRequests.push(request);
    });
    return { obsRefs: obsRefs, obsPostRequests: obsPostRequests, nonNormalResultRecorded: nonNormalResultRecorded, reflexTestTriggered: reflexTestTriggered };
};
var getObsDefFromActivityDef = function (obsDefId, activityDefContained) {
    var obsDef = activityDefContained.find(function (resource) { return resource.id === obsDefId && resource.resourceType === 'ObservationDefinition'; });
    if (!obsDef)
        throw new Error("activityDefinition.contained does not contain an ObservationDefinition with the id ".concat(obsDefId));
    return obsDef;
};
var formatObsValueAndInterpretation = function (dataEntry, obsDef, activityDefContained) {
    if (!obsDef.permittedDataType) {
        console.error('Obs def does not have a permittedDataType');
        throw new Error('No permittedDataType found on ObsDef');
    }
    if (obsDef.permittedDataType.includes('Quantity')) {
        var floatVal = parseFloat(dataEntry);
        var obsValue = {
            valueQuantity: {
                value: floatVal,
            },
        };
        var range = (0, utils_1.extractQuantityRange)(obsDef).normalRange;
        var _a = determineQuantInterpretation(floatVal, range), interpretationCodeableConcept = _a.interpretation, nonNormalResult = _a.nonNormalResult;
        var obsInterpretation = {
            interpretation: [interpretationCodeableConcept],
        };
        return { obsValue: obsValue, obsInterpretation: obsInterpretation, nonNormalResult: nonNormalResult };
    }
    if (obsDef.permittedDataType.includes('CodeableConcept')) {
        var obsValue = {
            valueString: dataEntry,
        };
        var filteredContained = activityDefContained.filter(function (resource) { return resource.resourceType === 'ObservationDefinition' || resource.resourceType === 'ValueSet'; });
        var abnormalValues = (0, utils_1.extractAbnormalValueSetValues)(obsDef, filteredContained);
        var isNeutral = abnormalValues.length === 0;
        console.log('isNeutral:', isNeutral);
        var _b = determineCodeableConceptInterpretation(dataEntry, abnormalValues), interpretationCodeableConcept = _b.interpretation, nonNormalResult = _b.nonNormalResult;
        var obsInterpretation = {
            interpretation: [interpretationCodeableConcept],
        };
        return { obsValue: obsValue, obsInterpretation: obsInterpretation, nonNormalResult: isNeutral ? utils_1.NonNormalResult.Neutral : nonNormalResult };
    }
    if (obsDef.permittedDataType.includes('string')) {
        var obsValue = {
            valueString: dataEntry,
        };
        // labs todo: in the future we can determine if we want to check string types for abnormality
        var obsInterpretation = {
            interpretation: [utils_1.NORMAL_OBSERVATION_INTERPRETATION],
        };
        return { obsValue: obsValue, obsInterpretation: obsInterpretation, nonNormalResult: undefined };
    }
    throw new Error('Cannot format Obs value and interpretation. Unrecognized obsDef.permittedDataType');
};
var determineQuantInterpretation = function (entry, range) {
    if (entry > range.high || entry < range.low) {
        return { interpretation: utils_1.ABNORMAL_OBSERVATION_INTERPRETATION, nonNormalResult: utils_1.NonNormalResult.Abnormal };
    }
    else {
        return { interpretation: utils_1.NORMAL_OBSERVATION_INTERPRETATION };
    }
};
// todo should also validate that the value passed is contained within normal values
var determineCodeableConceptInterpretation = function (value, abnormalValues) {
    if (value === utils_1.IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode) {
        return { interpretation: utils_1.INDETERMINATE_OBSERVATION_INTERPRETATION, nonNormalResult: utils_1.NonNormalResult.Inconclusive };
    }
    else {
        return abnormalValues.map(function (val) { return val.code; }).includes(value)
            ? { interpretation: utils_1.ABNORMAL_OBSERVATION_INTERPRETATION, nonNormalResult: utils_1.NonNormalResult.Abnormal }
            : { interpretation: utils_1.NORMAL_OBSERVATION_INTERPRETATION };
    }
};
var makeDiagnosticReportPostRequest = function (serviceRequest, activityDefinition, obsRefs, nonNormalResultRecorded, reflexTestTriggered) {
    if (!activityDefinition.code)
        throw new Error('activityDefinition.code is missing and is required');
    var diagnosticReportConfig = {
        resourceType: 'DiagnosticReport',
        basedOn: [{ reference: "ServiceRequest/".concat(serviceRequest.id) }],
        status: 'final',
        category: [{ coding: [utils_1.IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG] }],
        code: activityDefinition.code,
        subject: serviceRequest.subject,
        encounter: serviceRequest.encounter,
        specimen: serviceRequest.specimen,
        result: obsRefs,
    };
    var tags = [];
    var extension = [];
    if (nonNormalResultRecorded.length) {
        console.log('nonNormalResultRecorded', nonNormalResultRecorded);
        if (nonNormalResultRecorded.includes(utils_1.NonNormalResult.Abnormal)) {
            tags.push(utils_1.ABNORMAL_RESULT_DR_TAG);
        }
        if (nonNormalResultRecorded.includes(utils_1.NonNormalResult.Inconclusive)) {
            tags.push(utils_1.INCONCLUSIVE_RESULT_DR_TAG);
        }
        if (nonNormalResultRecorded.includes(utils_1.NonNormalResult.Neutral)) {
            tags.push(utils_1.NEUTRAL_RESULT_DR_TAG);
        }
    }
    else {
        console.log('all recorded results are reported normal');
    }
    if (reflexTestTriggered) {
        console.log('adding reflexTestTriggered extension to diagnostic report config');
        extension.push(reflexTestTriggered);
    }
    if (tags.length) {
        console.log('adding result tags to dr, count: ', tags.length);
        diagnosticReportConfig.meta = {
            tag: tags,
        };
    }
    if (extension.length) {
        console.log('adding extension to dr, count: ', extension.length);
        diagnosticReportConfig.extension = extension;
    }
    var diagnosticReportPostRequest = {
        method: 'POST',
        url: '/DiagnosticReport',
        resource: diagnosticReportConfig,
    };
    return diagnosticReportPostRequest;
};
var makeProvenancePostRequest = function (serviceRequestId, curUser, attendingPractitioner) {
    var provenanceFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
    var provenanceConfig = {
        resourceType: 'Provenance',
        target: [
            {
                reference: "ServiceRequest/".concat(serviceRequestId),
            },
        ],
        activity: {
            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults],
        },
        recorded: luxon_1.DateTime.now().toISO(),
        agent: [
            {
                who: { reference: "Practitioner/".concat(curUser.id), display: curUser.name },
                onBehalfOf: {
                    reference: "Practitioner/".concat(attendingPractitioner.id),
                    display: attendingPractitioner.name,
                },
            },
        ],
    };
    var provenancePostRequest = {
        method: 'POST',
        fullUrl: provenanceFullUrl,
        url: '/Provenance',
        resource: provenanceConfig,
    };
    return { provenancePostRequest: provenancePostRequest, provenanceFullUrl: provenanceFullUrl };
};
var makeIrtTaskPatchRequest = function (irtTask, provenanceFullUrl, curUser) {
    var _a;
    var provRef = {
        reference: provenanceFullUrl,
    };
    var operations = [
        {
            path: '/relevantHistory',
            op: irtTask.relevantHistory ? 'replace' : 'add',
            value: irtTask.relevantHistory ? __spreadArray(__spreadArray([], irtTask.relevantHistory, true), [provRef], false) : [provRef],
        },
        {
            path: '/status',
            op: 'replace',
            value: 'completed',
        },
    ];
    if (!irtTask.owner) {
        operations.push({
            path: '/owner',
            op: 'add',
            value: (0, tasks_1.createOwnerReference)(curUser.id, (_a = curUser.name) !== null && _a !== void 0 ? _a : ''),
        });
    }
    var irtTaskPatchRequest = {
        method: 'PATCH',
        url: "Task/".concat(irtTask.id),
        operations: operations,
    };
    return irtTaskPatchRequest;
};
