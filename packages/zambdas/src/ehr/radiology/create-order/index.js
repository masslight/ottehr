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
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var randomstring_1 = require("randomstring");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var validation_1 = require("./validation");
// Constants
// cSpell:disable-next date format
var DATE_FORMAT = 'yyyyMMddhhmmssuu';
var PERSON_IDENTIFIER_CODE_SYSTEM = 'https://fhir.ottehr.com/Identifier/person-uuid';
var ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL = 'http://advapacs.com/fhir/servicerequest-orderdetail-parameter-code';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'create-radiology-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (unsafeInput) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, validatedInput, callerUser, output, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                secrets = (0, validation_1.validateSecrets)(unsafeInput.secrets);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, (0, validation_1.validateInput)(unsafeInput, secrets, oystehr)];
            case 2:
                validatedInput = _a.sent();
                return [4 /*yield*/, getCallerUserWithAccessToken(validatedInput.callerAccessToken, secrets)];
            case 3:
                callerUser = _a.sent();
                return [4 /*yield*/, performEffect(validatedInput, callerUser.profile, secrets, oystehr)];
            case 4:
                output = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({ output: output }),
                    }];
            case 5:
                error_1 = _a.sent();
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, unsafeInput.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
var getCallerUserWithAccessToken = function (token, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (0, utils_1.userMe)(token, secrets)];
    });
}); };
var performEffect = function (validatedInput, practitionerRelativeReference, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var body, ourPractitioner, ourServiceRequest, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                body = validatedInput.body;
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerRelativeReference.split('/')[1],
                    })];
            case 1:
                ourPractitioner = _a.sent();
                return [4 /*yield*/, writeOurServiceRequest(body, practitionerRelativeReference, oystehr)];
            case 2:
                ourServiceRequest = _a.sent();
                if (!ourServiceRequest.id) {
                    throw new Error('Error creating service request, id is missing');
                }
                return [4 /*yield*/, writeOurProcedure(ourServiceRequest, secrets, oystehr)];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 8]);
                return [4 /*yield*/, writeAdvaPacsTransaction(ourServiceRequest, ourPractitioner, secrets, oystehr)];
            case 5:
                _a.sent();
                return [3 /*break*/, 8];
            case 6:
                error_2 = _a.sent();
                (0, aws_serverless_1.captureException)(error_2);
                console.error('Error sending order to AdvaPACS: ', error_2);
                return [4 /*yield*/, rollbackOurServiceRequest(ourServiceRequest, oystehr)];
            case 7:
                _a.sent();
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/, {
                    serviceRequestId: ourServiceRequest.id,
                }];
        }
    });
}); };
var writeOurServiceRequest = function (validatedBody, practitionerRelativeReference, oystehr) {
    var _a;
    var encounter = validatedBody.encounter, diagnosis = validatedBody.diagnosis, cpt = validatedBody.cpt, stat = validatedBody.stat, clinicalHistory = validatedBody.clinicalHistory;
    var now = luxon_1.DateTime.now();
    var fillerAndPlacerOrderNumber = randomstring_1.default.generate({
        length: 22,
        charset: 'alphanumeric',
        capitalization: 'uppercase',
    });
    var serviceRequest = {
        resourceType: 'ServiceRequest',
        meta: {
            tag: [
                {
                    system: shared_2.ORDER_TYPE_CODE_SYSTEM,
                    code: 'radiology',
                },
            ],
        },
        status: 'active',
        intent: 'order',
        identifier: [
            {
                type: {
                    coding: [
                        {
                            system: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
                            code: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER,
                        },
                    ],
                },
                system: shared_2.ACCESSION_NUMBER_CODE_SYSTEM,
                value: now.toFormat(DATE_FORMAT),
            },
            {
                type: {
                    coding: [
                        {
                            system: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
                            code: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM_PLACER_ORDER_NUMBER,
                        },
                    ],
                },
                system: shared_2.PLACER_ORDER_NUMBER_CODE_SYSTEM,
                value: fillerAndPlacerOrderNumber,
            },
            {
                type: {
                    coding: [
                        {
                            system: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM,
                            code: shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM_FILLER_ORDER_NUMBER,
                        },
                    ],
                },
                system: shared_2.FILLER_ORDER_NUMBER_CODE_SYSTEM,
                value: fillerAndPlacerOrderNumber,
            },
        ],
        category: [
            {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '363679005',
                        display: 'Imaging',
                    },
                ],
            },
        ],
        subject: {
            reference: (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference,
        },
        encounter: {
            reference: "Encounter/".concat(encounter.id),
        },
        requester: {
            reference: practitionerRelativeReference,
        },
        priority: stat ? 'stat' : 'routine',
        code: {
            coding: [cpt],
        },
        orderDetail: [
            {
                coding: [
                    {
                        system: 'http://dicom.nema.org/resources/ontology/DCM',
                        code: 'DX',
                    },
                ],
            },
        ],
        reasonCode: [
            {
                coding: [diagnosis],
            },
        ],
        authoredOn: now.toISO(),
        occurrenceDateTime: now.toISO(),
        extension: [
            {
                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
                extension: [
                    {
                        url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
                        extension: [
                            {
                                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
                                valueCodeableConcept: {
                                    coding: [
                                        {
                                            system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                                            code: 'modality',
                                        },
                                    ],
                                },
                            },
                            {
                                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
                                valueString: 'DX',
                            },
                        ],
                    },
                ],
            },
            {
                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
                extension: [
                    {
                        url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
                        extension: [
                            {
                                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
                                valueCodeableConcept: {
                                    coding: [
                                        {
                                            system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                                            code: 'clinical-history',
                                        },
                                    ],
                                },
                            },
                            {
                                url: shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
                                valueString: clinicalHistory,
                            },
                        ],
                    },
                ],
            },
            {
                url: shared_2.SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
                valueDateTime: now.toISO(),
            },
        ],
    };
    return oystehr.fhir.create(serviceRequest);
};
// This Procedure holds the CPT code for billing purposes
var writeOurProcedure = function (ourServiceRequest, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var procedureConfig;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                procedureConfig = {
                    resourceType: 'Procedure',
                    status: 'completed',
                    subject: ourServiceRequest.subject,
                    encounter: ourServiceRequest.encounter,
                    performer: (_a = ourServiceRequest.performer) === null || _a === void 0 ? void 0 : _a.map(function (performer) { return ({
                        actor: performer,
                    }); }),
                    code: ourServiceRequest.code,
                    meta: (0, shared_1.fillMeta)('cpt-code', 'cpt-code'), // This is necessary to get the Assessment part of the chart showing the CPT codes. It is some kind of save-chart-data feature that this meta is used to find and save the CPT codes instead of just looking at the FHIR Procedure resources code values.
                };
                return [4 /*yield*/, oystehr.fhir.create(procedureConfig)];
            case 1:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
var writeAdvaPacsTransaction = function (ourServiceRequest, ourPractitioner, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var advapacsClientId, advapacsClientSecret, advapacsAuthString, ourPatient, ourPatientId, ourRequestingPractitionerId, bestNameToSendForActor, patientToCreate, requestingPractitionerToCreate, serviceRequestToCreate, advaPacsTransactionRequest, advapacsResponse, _a, _b, _c, _d, _e, error_3;
    var _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    return __generator(this, function (_z) {
        switch (_z.label) {
            case 0:
                _z.trys.push([0, 5, , 6]);
                advapacsClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
                advapacsClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
                advapacsAuthString = "ID=".concat(advapacsClientId, ",Secret=").concat(advapacsClientSecret);
                return [4 /*yield*/, getOurSubject(((_f = ourServiceRequest.subject) === null || _f === void 0 ? void 0 : _f.reference) || '', oystehr)];
            case 1:
                ourPatient = _z.sent();
                ourPatientId = ourPatient.id;
                ourRequestingPractitionerId = (_h = (_g = ourServiceRequest.requester) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.split('/')[1];
                bestNameToSendForActor = function (resource) {
                    var nameToSend = resource.name;
                    if (resource.name && resource.name.length > 0) {
                        var officialName = resource.name.find(function (name) { return name.use === 'official'; });
                        nameToSend = officialName ? [officialName] : [resource.name[0]];
                    }
                    return nameToSend;
                };
                patientToCreate = {
                    method: 'PUT',
                    url: "Patient?identifier=".concat(PERSON_IDENTIFIER_CODE_SYSTEM, "|").concat(ourPatientId),
                    resource: {
                        resourceType: 'Patient',
                        identifier: [
                            {
                                system: PERSON_IDENTIFIER_CODE_SYSTEM,
                                value: ourPatientId,
                            },
                        ],
                        name: bestNameToSendForActor(ourPatient),
                        birthDate: ourPatient.birthDate,
                        gender: ourPatient.gender,
                    },
                };
                requestingPractitionerToCreate = {
                    method: 'PUT',
                    url: "Practitioner?identifier=".concat(PERSON_IDENTIFIER_CODE_SYSTEM, "|").concat(ourRequestingPractitionerId),
                    resource: {
                        resourceType: 'Practitioner',
                        identifier: [
                            {
                                system: PERSON_IDENTIFIER_CODE_SYSTEM,
                                value: ourRequestingPractitionerId,
                            },
                        ],
                        name: bestNameToSendForActor(ourPractitioner),
                        birthDate: ourPractitioner.birthDate,
                        gender: ourPractitioner.gender,
                    },
                };
                serviceRequestToCreate = {
                    method: 'PUT',
                    url: "ServiceRequest?identifier=".concat(shared_2.ACCESSION_NUMBER_CODE_SYSTEM, "|").concat((_j = ourServiceRequest.identifier) === null || _j === void 0 ? void 0 : _j[0].value),
                    resource: {
                        resourceType: 'ServiceRequest',
                        status: ourServiceRequest.status,
                        identifier: ourServiceRequest.identifier, // Identifier is the same in R4B and R5 so this is safe
                        intent: ourServiceRequest.intent,
                        subject: {
                            identifier: {
                                system: PERSON_IDENTIFIER_CODE_SYSTEM,
                                value: ourPatientId,
                            },
                        },
                        requester: {
                            identifier: {
                                system: PERSON_IDENTIFIER_CODE_SYSTEM,
                                value: ourRequestingPractitionerId,
                            },
                        },
                        code: {
                            concept: ourServiceRequest.code, // CodeableConcept is the same in R4B and R5 so this is safe
                        },
                        orderDetail: [
                            // we build R5 orderDetail from extensions we store in our R4B SR.orderDetail
                            {
                                parameter: [
                                    {
                                        code: {
                                            coding: [
                                                {
                                                    system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                                                    code: 'modality',
                                                },
                                            ],
                                        },
                                        valueString: (_r = (_q = (_p = (_o = (_m = (_l = (_k = ourServiceRequest.extension) === null || _k === void 0 ? void 0 : _k.filter(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL; })) === null || _l === void 0 ? void 0 : _l.find(function (orderDetailExt) {
                                            var _a, _b, _c, _d, _e;
                                            var parameterExt = (_a = orderDetailExt.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; });
                                            var codeExt = (_b = parameterExt === null || parameterExt === void 0 ? void 0 : parameterExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL; });
                                            return ((_e = (_d = (_c = codeExt === null || codeExt === void 0 ? void 0 : codeExt.valueCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code) === 'modality';
                                        })) === null || _m === void 0 ? void 0 : _m.extension) === null || _o === void 0 ? void 0 : _o.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; })) === null || _p === void 0 ? void 0 : _p.extension) === null || _q === void 0 ? void 0 : _q.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL; })) === null || _r === void 0 ? void 0 : _r.valueString,
                                    },
                                    {
                                        code: {
                                            coding: [
                                                {
                                                    system: ADVAPACS_ORDER_DETAIL_MODALITY_CODE_SYSTEM_URL,
                                                    code: 'clinical-history',
                                                },
                                            ],
                                        },
                                        valueString: (_y = (_x = (_w = (_v = (_u = (_t = (_s = ourServiceRequest.extension) === null || _s === void 0 ? void 0 : _s.filter(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL; })) === null || _t === void 0 ? void 0 : _t.find(function (orderDetailExt) {
                                            var _a, _b, _c, _d, _e;
                                            var parameterExt = (_a = orderDetailExt.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; });
                                            var codeExt = (_b = parameterExt === null || parameterExt === void 0 ? void 0 : parameterExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL; });
                                            return ((_e = (_d = (_c = codeExt === null || codeExt === void 0 ? void 0 : codeExt.valueCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code) === 'clinical-history';
                                        })) === null || _u === void 0 ? void 0 : _u.extension) === null || _v === void 0 ? void 0 : _v.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; })) === null || _w === void 0 ? void 0 : _w.extension) === null || _x === void 0 ? void 0 : _x.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL; })) === null || _y === void 0 ? void 0 : _y.valueString,
                                    },
                                ],
                            },
                        ],
                        authoredOn: ourServiceRequest.authoredOn,
                        occurrenceDateTime: ourServiceRequest.occurrenceDateTime,
                    },
                };
                advaPacsTransactionRequest = {
                    resourceType: 'Bundle',
                    type: 'transaction',
                    entry: [patientToCreate, requestingPractitionerToCreate, serviceRequestToCreate].map(function (request) {
                        return {
                            resource: __assign({}, request.resource),
                            request: {
                                method: request.method,
                                url: request.url,
                            },
                        };
                    }),
                };
                console.log(JSON.stringify(advaPacsTransactionRequest));
                return [4 /*yield*/, fetch(shared_2.ADVAPACS_FHIR_BASE_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                        body: JSON.stringify(advaPacsTransactionRequest),
                    })];
            case 2:
                advapacsResponse = _z.sent();
                if (!!advapacsResponse.ok) return [3 /*break*/, 4];
                _a = Error.bind;
                _c = (_b = "advapacs transaction errored out with statusCode ".concat(advapacsResponse.status, ", status text ").concat(advapacsResponse.statusText, ", and body ")).concat;
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, advapacsResponse.json()];
            case 3: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_e.apply(_d, [_z.sent(), null, 2])])]))();
            case 4: return [3 /*break*/, 6];
            case 5:
                error_3 = _z.sent();
                console.log('write transaction to advapacs error: ', error_3);
                throw error_3;
            case 6: return [2 /*return*/];
        }
    });
}); };
var getOurSubject = function (patientRelativeReference, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Patient',
                        id: patientRelativeReference.split('/')[1],
                    })];
            case 1: return [2 /*return*/, _b.sent()];
            case 2:
                _a = _b.sent();
                throw new Error('Error while trying to fetch our subject patient');
            case 3: return [2 /*return*/];
        }
    });
}); };
var rollbackOurServiceRequest = function (ourServiceRequest, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('rolling back our service request');
                if (!ourServiceRequest.id) {
                    throw new Error('rollbackOurServiceRequest: ServiceRequest id is missing');
                }
                return [4 /*yield*/, oystehr.fhir.delete({
                        resourceType: 'ServiceRequest',
                        id: ourServiceRequest.id,
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
