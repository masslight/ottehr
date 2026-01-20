"use strict";
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
var helpers_1 = require("../../shared/helpers");
var tasks_1 = require("../../shared/tasks");
var helpers_2 = require("../get-lab-orders/helpers");
var labs_1 = require("../shared/labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('create-lab-order', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, dx, encounter, orderableItem, psc, secrets, modifiedOrderingLocation, selectedPaymentMethod, clinicalInfoNoteByUser, oystehr, userToken, oystehrCurrentUser, curUserPractitionerId, _a, currentUserPractitioner, attendingPractitionerId, orgId, _b, labOrganization, coverageDetails, patient, existingOrderNumber, orderingLocation, orderLevelNote, requests_1, serviceRequestFullUrl, activityDefinitionToContain, serviceRequestContained, createSpecimenResources, specimenFullUrlArr_1, _c, specimenDefinitionConfigs, specimenConfigs, serviceRequestCode, serviceRequestReasonCode, requisitionNumber, serviceRequestConfig, serviceRequestSupportingInfo, coverageRefs, clientBillCoverage, clientOrg, clientBillCoverageConfig, clientBillCoverageFullUrl, postClientBillCoverageRequest, preSubmissionTaskConfig, aoeQRConfig, aoeQRFullUrl, postQrRequest, provenanceFullUrl, provenanceConfig, communicationConfig, communicationFullUrl, response, error_1, ENVIRONMENT;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                _o.trys.push([0, 9, , 10]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                dx = validatedParameters.dx, encounter = validatedParameters.encounter, orderableItem = validatedParameters.orderableItem, psc = validatedParameters.psc, secrets = validatedParameters.secrets, modifiedOrderingLocation = validatedParameters.orderingLocation, selectedPaymentMethod = validatedParameters.selectedPaymentMethod, clinicalInfoNoteByUser = validatedParameters.clinicalInfoNoteByUser;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _o.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                userToken = input.headers.Authorization.replace('Bearer ', '');
                oystehrCurrentUser = (0, helpers_1.createOystehrClient)(userToken, secrets);
                curUserPractitionerId = void 0;
                _o.label = 2;
            case 2:
                _o.trys.push([2, 4, , 5]);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 3:
                curUserPractitionerId = _o.sent();
                return [3 /*break*/, 5];
            case 4:
                _a = _o.sent();
                throw (0, utils_1.EXTERNAL_LAB_ERROR)('Resource configuration error - user creating this external lab order must have a Practitioner resource linked');
            case 5: return [4 /*yield*/, oystehrCurrentUser.fhir.get({
                    resourceType: 'Practitioner',
                    id: curUserPractitionerId,
                })];
            case 6:
                currentUserPractitioner = _o.sent();
                console.log('>>> this is the encounter,', JSON.stringify(encounter, undefined, 2));
                attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                if (!attendingPractitionerId) {
                    // this should never happen since theres also a validation on the front end that you cannot submit without one
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)('Resource configuration error - this encounter does not have an attending practitioner linked');
                }
                orgId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, secrets);
                return [4 /*yield*/, getAdditionalResources(orderableItem, encounter, psc, selectedPaymentMethod, oystehr, modifiedOrderingLocation, orgId)];
            case 7:
                _b = _o.sent(), labOrganization = _b.labOrganization, coverageDetails = _b.coverageDetails, patient = _b.patient, existingOrderNumber = _b.existingOrderNumber, orderingLocation = _b.orderingLocation, orderLevelNote = _b.orderLevelNote;
                validateLabOrgAndOrderingLocationAndGetAccountNumber(labOrganization, orderingLocation);
                requests_1 = [];
                serviceRequestFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                activityDefinitionToContain = formatActivityDefinitionToContain(orderableItem);
                serviceRequestContained = [];
                createSpecimenResources = !psc;
                console.log('is psc:', psc);
                console.log('createSpecimenResources:', createSpecimenResources);
                console.log('orderableItem.item.specimens.length:', orderableItem.item.specimens.length);
                specimenFullUrlArr_1 = [];
                if (createSpecimenResources) {
                    _c = formatSpecimenResources(orderableItem, (_d = patient.id) !== null && _d !== void 0 ? _d : '', serviceRequestFullUrl), specimenDefinitionConfigs = _c.specimenDefinitionConfigs, specimenConfigs = _c.specimenConfigs;
                    activityDefinitionToContain.specimenRequirement = specimenDefinitionConfigs.map(function (sd) { return ({
                        reference: "#".concat(sd.id),
                    }); });
                    serviceRequestContained.push.apply(serviceRequestContained, __spreadArray([activityDefinitionToContain], specimenDefinitionConfigs, false));
                    specimenConfigs.forEach(function (specimenResource) {
                        var specimenFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                        specimenFullUrlArr_1 === null || specimenFullUrlArr_1 === void 0 ? void 0 : specimenFullUrlArr_1.push(specimenFullUrl);
                        requests_1.push({
                            method: 'POST',
                            url: '/Specimen',
                            resource: specimenResource,
                            fullUrl: specimenFullUrl,
                        });
                    });
                }
                else {
                    serviceRequestContained.push(activityDefinitionToContain);
                }
                serviceRequestCode = formatSrCode(orderableItem);
                serviceRequestReasonCode = dx.map(function (diagnosis) {
                    return {
                        coding: [
                            {
                                system: utils_1.FHIR_IDC10_VALUESET_SYSTEM,
                                code: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.code,
                                display: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.display,
                            },
                        ],
                        text: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.display,
                    };
                });
                requisitionNumber = existingOrderNumber || (0, utils_1.createOrderNumber)(utils_1.ORDER_NUMBER_LEN);
                serviceRequestConfig = {
                    resourceType: 'ServiceRequest',
                    status: 'draft',
                    intent: 'order',
                    subject: {
                        reference: "Patient/".concat(patient.id),
                    },
                    encounter: {
                        reference: "Encounter/".concat(encounter.id),
                    },
                    requester: {
                        reference: "Practitioner/".concat(attendingPractitionerId),
                    },
                    performer: [
                        {
                            reference: "Organization/".concat(labOrganization.id),
                            identifier: {
                                system: utils_1.OYSTEHR_LAB_GUID_SYSTEM,
                                value: (_f = (_e = labOrganization.identifier) === null || _e === void 0 ? void 0 : _e.find(function (id) { return id.system === utils_1.OYSTEHR_LAB_GUID_SYSTEM; })) === null || _f === void 0 ? void 0 : _f.value,
                            },
                        },
                    ],
                    authoredOn: luxon_1.DateTime.now().toISO() || undefined,
                    priority: 'stat',
                    code: serviceRequestCode,
                    reasonCode: serviceRequestReasonCode,
                    instantiatesCanonical: ["#".concat(activityDefinitionToContain.id)],
                    contained: serviceRequestContained,
                    identifier: [
                        {
                            system: utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
                            value: requisitionNumber,
                        },
                    ],
                };
                serviceRequestConfig.locationReference = [
                    {
                        type: 'Location',
                        reference: "Location/".concat(orderingLocation.id),
                    },
                ];
                serviceRequestSupportingInfo = [];
                console.log('selected payment method', selectedPaymentMethod);
                if (coverageDetails.type === utils_1.LabPaymentMethod.Insurance) {
                    console.log('assigning serviceRequestConfig.insurance');
                    coverageRefs = coverageDetails.insuranceCoverages.map(function (coverage) {
                        return {
                            reference: "Coverage/".concat(coverage.id),
                        };
                    });
                    serviceRequestConfig.insurance = coverageRefs;
                }
                else if (coverageDetails.type === utils_1.LabPaymentMethod.ClientBill) {
                    clientBillCoverage = coverageDetails.clientBillCoverage, clientOrg = coverageDetails.clientOrg;
                    if (clientBillCoverage) {
                        console.log("assigning existing client bill coverage to service request config ".concat(clientBillCoverage.id));
                        serviceRequestConfig.insurance = [{ reference: "Coverage/".concat(clientBillCoverage.id) }];
                    }
                    else if (!clientBillCoverage) {
                        console.log('getting config for to create a new client bill coverage');
                        clientBillCoverageConfig = getClientBillCoverageConfig(patient, clientOrg, labOrganization);
                        clientBillCoverageFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                        postClientBillCoverageRequest = {
                            method: 'POST',
                            url: '/Coverage',
                            resource: clientBillCoverageConfig,
                            fullUrl: clientBillCoverageFullUrl,
                        };
                        requests_1.push(postClientBillCoverageRequest);
                        serviceRequestConfig.insurance = [{ reference: clientBillCoverageFullUrl }];
                    }
                }
                if (psc) {
                    serviceRequestConfig.orderDetail = [
                        {
                            coding: [
                                {
                                    system: utils_1.PSC_HOLD_CONFIG.system,
                                    code: utils_1.PSC_HOLD_CONFIG.code,
                                    display: utils_1.PSC_HOLD_CONFIG.display,
                                },
                            ],
                            text: utils_1.PSC_HOLD_CONFIG.display,
                        },
                    ];
                }
                if (specimenFullUrlArr_1.length > 0) {
                    serviceRequestConfig.specimen = specimenFullUrlArr_1.map(function (url) { return ({
                        type: 'Specimen',
                        reference: url,
                    }); });
                }
                preSubmissionTaskConfig = (0, tasks_1.createTask)({
                    category: utils_1.LAB_ORDER_TASK.category,
                    code: {
                        system: utils_1.LAB_ORDER_TASK.system,
                        code: utils_1.LAB_ORDER_TASK.code.preSubmission,
                    },
                    encounterId: (_g = encounter.id) !== null && _g !== void 0 ? _g : '',
                    location: orderingLocation.id
                        ? {
                            id: orderingLocation.id,
                        }
                        : undefined,
                    basedOn: [serviceRequestFullUrl],
                    input: [
                        {
                            type: utils_1.LAB_ORDER_TASK.input.testName,
                            valueString: activityDefinitionToContain.name,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.labName,
                            valueString: labOrganization.name,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.patientName,
                            valueString: (0, utils_1.getFullestAvailableName)(patient),
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.providerName,
                            valueString: (0, utils_1.getFullestAvailableName)(currentUserPractitioner),
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.orderDate,
                            valueString: serviceRequestConfig.authoredOn,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.appointmentId,
                            valueString: (_l = (_k = (_j = (_h = encounter.appointment) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.split('/')) === null || _l === void 0 ? void 0 : _l[1],
                        },
                    ],
                });
                aoeQRConfig = formatAoeQR(serviceRequestFullUrl, encounter.id || '', orderableItem);
                if (aoeQRConfig) {
                    aoeQRFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                    postQrRequest = {
                        method: 'POST',
                        url: '/QuestionnaireResponse',
                        resource: aoeQRConfig,
                        fullUrl: aoeQRFullUrl,
                    };
                    requests_1.push(postQrRequest);
                    serviceRequestSupportingInfo.push({
                        type: 'QuestionnaireResponse',
                        reference: aoeQRFullUrl,
                    });
                }
                provenanceFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                provenanceConfig = getProvenanceConfig(serviceRequestFullUrl, orderingLocation.id, curUserPractitionerId, attendingPractitionerId);
                serviceRequestConfig.relevantHistory = [
                    {
                        reference: provenanceFullUrl,
                    },
                ];
                if (clinicalInfoNoteByUser) {
                    console.log('adding request to create a communication resources for clinical info notes');
                    communicationConfig = {
                        resourceType: 'Communication',
                        status: 'completed',
                        identifier: [
                            {
                                system: utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
                                value: requisitionNumber,
                            },
                        ],
                        basedOn: [{ reference: serviceRequestFullUrl }],
                        category: [
                            {
                                coding: [utils_1.LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY],
                            },
                        ],
                        payload: [{ contentString: clinicalInfoNoteByUser }],
                    };
                    communicationFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                    requests_1.push({
                        method: 'POST',
                        url: '/Communication',
                        resource: communicationConfig,
                        fullUrl: communicationFullUrl,
                    });
                    serviceRequestSupportingInfo.push({
                        type: 'Communication',
                        reference: communicationFullUrl,
                    });
                }
                if (serviceRequestSupportingInfo.length > 0) {
                    serviceRequestConfig.supportingInfo = serviceRequestSupportingInfo;
                }
                requests_1.push({
                    method: 'POST',
                    url: '/Provenance',
                    resource: provenanceConfig,
                    fullUrl: provenanceFullUrl,
                });
                requests_1.push({
                    method: 'POST',
                    url: '/Task',
                    resource: preSubmissionTaskConfig,
                });
                requests_1.push({
                    method: 'POST',
                    url: '/ServiceRequest',
                    resource: serviceRequestConfig,
                    fullUrl: serviceRequestFullUrl,
                });
                if (orderLevelNote) {
                    console.log('since an order level note exists for this order, we must add the new service request to its based-on');
                    requests_1.push({
                        method: 'PATCH',
                        url: "Communication/".concat(orderLevelNote.id),
                        operations: [{ op: 'add', path: "/basedOn/-", value: { reference: serviceRequestFullUrl } }],
                        ifMatch: ((_m = orderLevelNote.meta) === null || _m === void 0 ? void 0 : _m.versionId) ? "W/\"".concat(orderLevelNote.meta.versionId, "\"") : undefined,
                    });
                }
                console.log('making transaction request');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests_1 })];
            case 8:
                _o.sent();
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 9:
                error_1 = _o.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-create-lab-order', error_1, ENVIRONMENT)];
            case 10: return [2 /*return*/];
        }
    });
}); });
var formatAoeQR = function (serviceRequestFullUrl, encounterId, orderableItem) {
    if (!orderableItem.item.aoe)
        return;
    return {
        resourceType: 'QuestionnaireResponse',
        questionnaire: orderableItem.item.aoe.url,
        encounter: {
            reference: "Encounter/".concat(encounterId),
        },
        basedOn: [
            {
                type: 'ServiceRequest',
                reference: serviceRequestFullUrl,
            },
        ],
        status: 'in-progress',
    };
};
var formatSrCode = function (orderableItem) {
    var coding = [
        {
            system: utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM,
            code: orderableItem.item.itemCode,
            display: orderableItem.item.itemName,
        },
    ];
    if (orderableItem.item.itemLoinc) {
        coding.push({
            system: 'http://loinc.org',
            code: orderableItem.item.itemLoinc,
        });
    }
    return {
        coding: coding,
        text: orderableItem.item.itemName,
    };
};
var formatActivityDefinitionToContain = function (orderableItem) {
    var activityDefinitionConfig = {
        resourceType: 'ActivityDefinition',
        id: 'activityDefinitionId',
        status: 'unknown',
        code: {
            coding: [
                {
                    system: utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM,
                    code: orderableItem.item.itemCode,
                    display: orderableItem.item.itemName,
                },
            ],
        },
        publisher: orderableItem.lab.labName,
        kind: 'ServiceRequest',
        title: orderableItem.item.itemName,
        name: orderableItem.item.uniqueName,
        url: "https://labs-api.zapehr.com/v1/orderableItem?labIds=".concat(orderableItem.lab.labGuid, "&itemCodes=").concat(orderableItem.item.itemCode),
        version: orderableItem.lab.compendiumVersion,
    };
    return activityDefinitionConfig;
};
var formatSpecimenResources = function (orderableItem, patientID, serviceRequestFullUrl) {
    var specimenDefinitionConfigs = [];
    var specimenConfigs = [];
    // facilitates always showing specimen entry on submit page
    // https://github.com/masslight/ottehr/issues/2934
    if (orderableItem.item.specimens.length === 0) {
        var _a = getSpecimenAndSpecimenDefConfig(serviceRequestFullUrl, patientID, 0, undefined), specimenDefinitionConfig = _a.specimenDefinitionConfig, specimenConfig = _a.specimenConfig;
        specimenDefinitionConfigs.push(specimenDefinitionConfig);
        specimenConfigs.push(specimenConfig);
    }
    else {
        orderableItem.item.specimens.forEach(function (specimen, idx) {
            var _a = getSpecimenAndSpecimenDefConfig(serviceRequestFullUrl, patientID, idx, specimen), specimenDefinitionConfig = _a.specimenDefinitionConfig, specimenConfig = _a.specimenConfig;
            specimenDefinitionConfigs.push(specimenDefinitionConfig);
            specimenConfigs.push(specimenConfig);
        });
    }
    return { specimenDefinitionConfigs: specimenDefinitionConfigs, specimenConfigs: specimenConfigs };
};
var getProvenanceConfig = function (serviceRequestFullUrl, locationId, currentUserId, attendingPractitionerId) {
    var provenanceConfig = {
        resourceType: 'Provenance',
        activity: {
            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
        },
        target: [
            {
                reference: serviceRequestFullUrl,
            },
        ],
        recorded: luxon_1.DateTime.now().toISO(),
        agent: [
            {
                who: { reference: "Practitioner/".concat(currentUserId) },
                onBehalfOf: { reference: "Practitioner/".concat(attendingPractitionerId) },
            },
        ],
    };
    if (locationId)
        provenanceConfig.location = { reference: "Location/".concat(locationId) };
    return provenanceConfig;
};
var getAdditionalResources = function (orderableItem, encounter, psc, selectedPaymentMethod, oystehr, modifiedOrderingLocation, clientOrgId) { return __awaiter(void 0, void 0, void 0, function () {
    var labName, labGuid, labOrganizationSearchRequest, encounterResourceSearch, orderingLocationSearch, requests, paymentMethodIsClientBill, clientOrgSearch, searchResults, labOrganizationSearchResults, insuranceCoverageSearchResults, accountSearchResults, draftServiceRequests, serviceRequestsForBundle, patientSearchResults, orderLevelNotes, orderingLocation, clientOrg, clientBillCoverage, resources, existingOrderNumber, patientAccount, coveragesSortedByPriority, patient, labOrganization, coverageDetails, orderLevelNote;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                labName = orderableItem.lab.labName;
                labGuid = orderableItem.lab.labGuid;
                labOrganizationSearchRequest = {
                    method: 'GET',
                    url: "/Organization?type=".concat(utils_1.LAB_ORG_TYPE_CODING.system, "|").concat(utils_1.LAB_ORG_TYPE_CODING.code, "&identifier=").concat(utils_1.OYSTEHR_LAB_GUID_SYSTEM, "|").concat(labGuid),
                };
                encounterResourceSearch = {
                    method: 'GET',
                    url: "/Encounter?_id=".concat(encounter.id, "&_include=Encounter:patient&_revinclude:iterate=Coverage:patient&_revinclude:iterate=Account:patient&_revinclude:iterate=ServiceRequest:encounter&_revinclude:iterate=Communication:based-on"),
                };
                orderingLocationSearch = {
                    method: 'GET',
                    url: "/Location?status=active&_id=".concat(modifiedOrderingLocation.id),
                };
                requests = [labOrganizationSearchRequest, encounterResourceSearch, orderingLocationSearch];
                paymentMethodIsClientBill = selectedPaymentMethod === utils_1.LabPaymentMethod.ClientBill;
                if (paymentMethodIsClientBill) {
                    clientOrgSearch = {
                        method: 'GET',
                        url: "/Organization?_id=".concat(clientOrgId),
                    };
                    requests.push(clientOrgSearch);
                }
                console.log('searching for create lab fhir resources');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 1:
                searchResults = _a.sent();
                labOrganizationSearchResults = [];
                insuranceCoverageSearchResults = [];
                accountSearchResults = [];
                draftServiceRequests = [];
                serviceRequestsForBundle = [];
                patientSearchResults = [];
                orderLevelNotes = [];
                orderingLocation = undefined;
                clientOrg = undefined;
                clientBillCoverage = undefined;
                resources = (0, utils_1.flattenBundleResources)(searchResults);
                console.log('parsing resources from search');
                resources.forEach(function (resource) {
                    var _a, _b;
                    if (resource.resourceType === 'Organization') {
                        if (resource.id === clientOrgId) {
                            clientOrg = resource;
                        }
                        else if ((_a = resource.identifier) === null || _a === void 0 ? void 0 : _a.some(function (id) { return id.system === utils_1.OYSTEHR_LAB_GUID_SYSTEM; })) {
                            labOrganizationSearchResults.push(resource);
                        }
                    }
                    if (resource.resourceType === 'Coverage' && resource.status === 'active') {
                        var paymentMethod = (0, utils_1.paymentMethodFromCoverage)(resource);
                        console.log('paymentMethod parsed from coverage when organizing resources', paymentMethod, resource.id);
                        if (paymentMethod === utils_1.LabPaymentMethod.Insurance) {
                            insuranceCoverageSearchResults.push(resource);
                        }
                        else if (paymentMethod === utils_1.LabPaymentMethod.ClientBill) {
                            var labGuidFromClientBillCoverage = getLabGuidFromClientBillCoverage(resource);
                            if (labGuidFromClientBillCoverage === labGuid) {
                                if (clientBillCoverage) {
                                    console.warn("Warning: multiple active client bill coverages exist for this patient / lab relationship");
                                }
                                clientBillCoverage = resource;
                            }
                        }
                    }
                    if (resource.resourceType === 'Patient')
                        patientSearchResults.push(resource);
                    if (resource.resourceType === 'Account' && resource.status === 'active') {
                        // todo labs team - this logic will change when we implement workers comp, but for now
                        // we will just ignore those types of accounts to restore functionality
                        if ((0, labs_1.accountIsPatientBill)(resource))
                            accountSearchResults.push(resource);
                    }
                    if (resource.resourceType === 'Location') {
                        if ((_b = resource.identifier) === null || _b === void 0 ? void 0 : _b.some(function (id) { var _a; return id.system === utils_1.LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && ((_a = id.assigner) === null || _a === void 0 ? void 0 : _a.reference); }))
                            orderingLocation = resource;
                    }
                    if (resource.resourceType === 'Communication') {
                        var labCommType = (0, helpers_2.labOrderCommunicationType)(resource);
                        if (labCommType === 'order-level-note')
                            orderLevelNotes.push(resource);
                    }
                    // we will use these to determine if the current order is able to be bundled with any existing
                    // anything past draft status is automatically in a different bundle
                    if (resource.resourceType === 'ServiceRequest' && resource.status === 'draft') {
                        draftServiceRequests.push(resource);
                    }
                });
                console.log('resource parsing complete');
                if (draftServiceRequests.length) {
                    console.log(">>>>> checking draft service request array for bundle-able orders (".concat(draftServiceRequests.length, " will be reviewed)"));
                    draftServiceRequests.forEach(function (sr, idx) {
                        var _a, _b, _c;
                        console.log('\n reviewing draft sr at idx', idx);
                        // only requests to the same lab that have not yet been submitted will be bundled
                        var draftSRFillerLab = (_c = (_b = (_a = sr.performer) === null || _a === void 0 ? void 0 : _a.find(function (org) { var _a; return ((_a = org.identifier) === null || _a === void 0 ? void 0 : _a.system) === utils_1.OYSTEHR_LAB_GUID_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.identifier) === null || _c === void 0 ? void 0 : _c.value;
                        if (draftSRFillerLab === labGuid) {
                            var allCoverages = __spreadArray([], insuranceCoverageSearchResults, true);
                            if (clientBillCoverage)
                                allCoverages.push(clientBillCoverage);
                            var resourcePaymentMethod = (0, utils_1.serviceRequestPaymentMethod)(sr, allCoverages);
                            var paymentMethodMatches = selectedPaymentMethod === resourcePaymentMethod;
                            // different payment method selection means the order must be in a different bundle,
                            // IN1 (insurance) is shared across all order segments
                            if (paymentMethodMatches) {
                                var curSrIsPsc = (0, utils_1.isPSCOrder)(sr);
                                if (curSrIsPsc === psc) {
                                    // we bundled psc orders separately, so if the current test being submitted is psc
                                    // it should only be bundled under the same requisition number if there are other psc orders for this lab
                                    serviceRequestsForBundle.push(sr);
                                }
                            }
                            else {
                                console.log("differing payment methods:\n          draft sr payment method: ".concat(resourcePaymentMethod));
                            }
                        }
                        else {
                            console.log("differing labs:\n          draft sr was submitted to lab: ".concat(draftSRFillerLab, "\n          lab currently being created is being filled by ").concat(labGuid));
                        }
                    });
                    console.log('\n >>>>> done reviewing draft service request array');
                }
                else {
                    console.log('no draft service requests parsed');
                }
                if (serviceRequestsForBundle.length) {
                    console.log('grabbing the order number from the first service request in serviceRequestsForBundle');
                    existingOrderNumber = (0, utils_1.getOrderNumber)(serviceRequestsForBundle[0]);
                }
                else {
                    console.log('no like orders exist, a new bundle will be created');
                }
                if (accountSearchResults.length !== 1)
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)('Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders');
                patientAccount = accountSearchResults[0];
                coveragesSortedByPriority = (0, labs_1.sortCoveragesByPriority)(patientAccount, insuranceCoverageSearchResults);
                patient = patientSearchResults === null || patientSearchResults === void 0 ? void 0 : patientSearchResults[0];
                if (!patient) {
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)("Patient resource could not be parsed from fhir search for create external lab");
                }
                labOrganization = labOrganizationSearchResults === null || labOrganizationSearchResults === void 0 ? void 0 : labOrganizationSearchResults[0];
                if (!labOrganization) {
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)("Organization resource for ".concat(labName, " may be misconfigured. No organization found for lab guid ").concat(labGuid));
                }
                if (!orderingLocation) {
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)("No location found matching selected office Location id ".concat(modifiedOrderingLocation.id));
                }
                switch (selectedPaymentMethod) {
                    case utils_1.LabPaymentMethod.ClientBill:
                        if (!clientOrg) {
                            throw (0, utils_1.EXTERNAL_LAB_ERROR)("Payment method is client bill but no org was found matching the configured client org id: ".concat(clientOrgId));
                        }
                        coverageDetails = {
                            type: utils_1.LabPaymentMethod.ClientBill,
                            clientBillCoverage: clientBillCoverage,
                            clientOrg: clientOrg,
                        };
                        break;
                    case utils_1.LabPaymentMethod.Insurance:
                        if (!coveragesSortedByPriority) {
                            throw (0, utils_1.EXTERNAL_LAB_ERROR)("Payment method is insurance but no insurances were found");
                        }
                        coverageDetails = {
                            type: utils_1.LabPaymentMethod.Insurance,
                            insuranceCoverages: coveragesSortedByPriority,
                        };
                        break;
                    case utils_1.LabPaymentMethod.SelfPay:
                        coverageDetails = {
                            type: utils_1.LabPaymentMethod.SelfPay,
                        };
                        break;
                    default:
                        throw (0, utils_1.EXTERNAL_LAB_ERROR)("Unknown selected payment method ".concat(selectedPaymentMethod));
                }
                orderLevelNote = getExistingOrderLevelNote(orderLevelNotes, existingOrderNumber);
                return [2 /*return*/, {
                        labOrganization: labOrganization,
                        patient: patient,
                        coverageDetails: coverageDetails,
                        existingOrderNumber: existingOrderNumber,
                        orderingLocation: orderingLocation,
                        orderLevelNote: orderLevelNote,
                    }];
        }
    });
}); };
var getSpecimenAndSpecimenDefConfig = function (serviceRequestFullUrl, patientID, idx, specimen) {
    var _a, _b, _c, _d;
    // labs sometimes set container, volume, minimumVolume, storageRequirements, or collectionInstructions to null, so need to coalesce to undefined
    var collectionInstructionsCoding = {
        coding: [
            {
                system: utils_1.SPECIMEN_CODING_CONFIG.collection.system,
                code: utils_1.SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions,
            },
        ],
        text: (_a = specimen === null || specimen === void 0 ? void 0 : specimen.collectionInstructions) !== null && _a !== void 0 ? _a : undefined,
    };
    var specimenDefinitionId = "specimenDefinitionId".concat(idx);
    var specimenDefinitionConfig = {
        resourceType: 'SpecimenDefinition',
        id: specimenDefinitionId,
        collection: [
            collectionInstructionsCoding,
            {
                coding: [
                    {
                        system: utils_1.SPECIMEN_CODING_CONFIG.collection.system,
                        code: utils_1.SPECIMEN_CODING_CONFIG.collection.code.specimenVolume,
                    },
                ],
                text: (_b = specimen === null || specimen === void 0 ? void 0 : specimen.volume) !== null && _b !== void 0 ? _b : undefined,
            },
        ],
        typeTested: [
            {
                preference: 'preferred',
                container: !!(specimen === null || specimen === void 0 ? void 0 : specimen.container) || !!(specimen === null || specimen === void 0 ? void 0 : specimen.minimumVolume)
                    ? {
                        description: (_c = specimen.container) !== null && _c !== void 0 ? _c : undefined,
                        minimumVolumeString: (_d = specimen.minimumVolume) !== null && _d !== void 0 ? _d : undefined,
                    }
                    : undefined,
                handling: (specimen === null || specimen === void 0 ? void 0 : specimen.storageRequirements)
                    ? [
                        {
                            instruction: specimen.storageRequirements,
                        },
                    ]
                    : undefined,
            },
        ],
    };
    var specimenConfig = {
        resourceType: 'Specimen',
        request: [{ reference: serviceRequestFullUrl }],
        collection: {
            method: collectionInstructionsCoding,
        },
        extension: [
            {
                url: utils_1.RELATED_SPECIMEN_DEFINITION_SYSTEM,
                valueString: specimenDefinitionId,
            },
        ],
        subject: {
            type: 'Patient',
            reference: "Patient/".concat(patientID),
        },
    };
    return { specimenDefinitionConfig: specimenDefinitionConfig, specimenConfig: specimenConfig };
};
/**
 * Ensures the ordering location is configured to order labs from the Lab Organization determined from the orderable item.
 * If yes, grabs the order location's account number for that Lab Org. Errors otherwise.
 * @param labOrganization
 * @param orderingLocation
 */
function validateLabOrgAndOrderingLocationAndGetAccountNumber(labOrganization, orderingLocation) {
    var _a;
    console.log('These are the Location identifiers', JSON.stringify(orderingLocation.identifier));
    var orderingLocationLabInfo = (_a = orderingLocation.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { var _a; return id.system === utils_1.LAB_ACCOUNT_NUMBER_SYSTEM && ((_a = id.assigner) === null || _a === void 0 ? void 0 : _a.reference) === "Organization/".concat(labOrganization.id); });
    if (!orderingLocationLabInfo) {
        console.error("Ordering Location/".concat(orderingLocation.id, " is not configured to order labs from Organization/").concat(labOrganization.id));
        throw (0, utils_1.EXTERNAL_LAB_ERROR)("The '".concat(orderingLocation.name, "' location is not configured to order labs from ").concat(labOrganization.name));
    }
    if (!orderingLocationLabInfo.value) {
        console.error("Ordering Location/".concat(orderingLocation.id, " missing account number for Organization/").concat(labOrganization.id));
        throw (0, utils_1.EXTERNAL_LAB_ERROR)("No account number found for ".concat(labOrganization.name, " for the ").concat(orderingLocation.name, " location"));
    }
    return orderingLocationLabInfo.value;
}
function getClientBillCoverageConfig(patient, clientOrg, labOrg) {
    var _a, _b;
    var clientBillCoverageConfig = {
        resourceType: 'Coverage',
        status: 'active',
        beneficiary: {
            reference: "Patient/".concat(patient.id),
        },
        subscriber: {
            reference: "Patient/".concat(patient.id),
        },
        type: { coding: [utils_1.LAB_CLIENT_BILL_COVERAGE_TYPE_CODING] },
        payor: [
            {
                reference: "Organization/".concat(clientOrg.id),
            },
        ],
        policyHolder: {
            reference: "Organization/".concat(labOrg.id),
            identifier: {
                system: utils_1.OYSTEHR_LAB_GUID_SYSTEM,
                value: (_b = (_a = labOrg.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.OYSTEHR_LAB_GUID_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value,
            },
        },
    };
    return clientBillCoverageConfig;
}
function getLabGuidFromClientBillCoverage(coverage) {
    var _a;
    var clientBillCoverageIdentifier = (_a = coverage.policyHolder) === null || _a === void 0 ? void 0 : _a.identifier;
    var labGuidFromClientBillCoverage;
    if ((clientBillCoverageIdentifier === null || clientBillCoverageIdentifier === void 0 ? void 0 : clientBillCoverageIdentifier.system) === utils_1.OYSTEHR_LAB_GUID_SYSTEM) {
        labGuidFromClientBillCoverage = clientBillCoverageIdentifier.value;
    }
    return labGuidFromClientBillCoverage;
}
var getExistingOrderLevelNote = function (orderLevelNotes, existingOrderNumber) {
    if (!orderLevelNotes || !existingOrderNumber)
        return;
    console.log('checking communications for an order level note linked to this existing order number', existingOrderNumber);
    var notesForThisOrder = orderLevelNotes.filter(function (comm) {
        var _a;
        return (_a = comm.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM && id.value === existingOrderNumber; });
    });
    console.log('number of notesForThisOrder found', notesForThisOrder.length);
    if (notesForThisOrder.length === 0)
        return;
    if (notesForThisOrder.length > 1) {
        throw new Error("Resources for this bundle are misconfigured. More than one order level note exists. These are the Ids: ".concat(notesForThisOrder.map(function (comm) { return "Communication/".concat(comm.id); })));
    }
    return notesForThisOrder[0];
};
