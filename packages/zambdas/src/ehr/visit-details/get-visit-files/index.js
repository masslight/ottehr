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
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
exports.searchDocumentReferencesForVisit = searchDocumentReferencesForVisit;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ZAMBDA_NAME = 'get-visit-files';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, userToken, oystehr, effectInput, files, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets, userToken = validatedParameters.userToken;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                return [4 /*yield*/, getFileResources(effectInput, oystehr, userToken)];
            case 3:
                files = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(files),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
function getFileResources(input, oystehr, userToken) {
    return __awaiter(this, void 0, void 0, function () {
        function compareCards(cardBackType) {
            return function (a, b) {
                if (a && b) {
                    return a.type === cardBackType ? 1 : -1;
                }
                return 0;
            };
        }
        var patientId, appointmentId, documents, documentReferenceResources, z3Documents, _i, documentReferenceResources_1, docRef, docRefCode, _a, _b, content, title, z3Url, presignedUrl;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    patientId = input.patientId, appointmentId = input.appointmentId;
                    documents = {
                        photoIdCards: [],
                        insuranceCards: [],
                        insuranceCardsSecondary: [],
                        fullCardPdfs: [],
                        consentPdfUrls: [],
                    };
                    return [4 /*yield*/, searchDocumentReferencesForVisit(oystehr, patientId, appointmentId)];
                case 1:
                    documentReferenceResources = _e.sent();
                    z3Documents = [];
                    _i = 0, documentReferenceResources_1 = documentReferenceResources;
                    _e.label = 2;
                case 2:
                    if (!(_i < documentReferenceResources_1.length)) return [3 /*break*/, 7];
                    docRef = documentReferenceResources_1[_i];
                    docRefCode = (_d = (_c = docRef.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code;
                    if (!(docRefCode &&
                        ([
                            utils_1.PHOTO_ID_CARD_CODE,
                            utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code,
                            utils_1.PAPERWORK_CONSENT_CODING_LOINC.code,
                            utils_1.PRIVACY_POLICY_CODE,
                        ].includes(docRefCode) ||
                            docRefCode === utils_1.INSURANCE_CARD_CODE))) return [3 /*break*/, 6];
                    _a = 0, _b = docRef.content;
                    _e.label = 3;
                case 3:
                    if (!(_a < _b.length)) return [3 /*break*/, 6];
                    content = _b[_a];
                    title = content.attachment.title;
                    z3Url = content.attachment.url;
                    if (!(z3Url && title)) return [3 /*break*/, 5];
                    if ([utils_1.PHOTO_ID_CARD_CODE, utils_1.INSURANCE_CARD_CODE].includes(docRefCode) &&
                        (!title || !Object.values(utils_1.DocumentType).includes(title))) {
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, (0, utils_1.getPresignedURL)(z3Url, userToken)];
                case 4:
                    presignedUrl = _e.sent();
                    if (presignedUrl) {
                        z3Documents.push({
                            z3Url: z3Url,
                            presignedUrl: presignedUrl,
                            type: title,
                            code: docRefCode,
                        });
                    }
                    _e.label = 5;
                case 5:
                    _a++;
                    return [3 /*break*/, 3];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    if (!z3Documents) {
                        return [2 /*return*/, documents];
                    }
                    if (z3Documents.length) {
                        documents.photoIdCards = z3Documents
                            .filter(function (doc) { return [utils_1.DocumentType.PhotoIdFront, utils_1.DocumentType.PhotoIdBack].includes(doc.type); })
                            .slice(0, 2) // we're slicing all these because somewhere we're failing to mark the DR as no longer current and are getting multiples
                            .sort(compareCards(utils_1.DocumentType.PhotoIdBack));
                        documents.insuranceCards = z3Documents
                            .filter(function (doc) { return [utils_1.DocumentType.InsuranceFront, utils_1.DocumentType.InsuranceBack].includes(doc.type); })
                            .slice(0, 2)
                            .sort(compareCards(utils_1.DocumentType.InsuranceBack));
                        documents.insuranceCardsSecondary = z3Documents
                            .filter(function (doc) { return [utils_1.DocumentType.InsuranceFrontSecondary, utils_1.DocumentType.InsuranceBackSecondary].includes(doc.type); })
                            .slice(0, 2)
                            .sort(compareCards(utils_1.DocumentType.InsuranceBackSecondary));
                        documents.fullCardPdfs = z3Documents.filter(function (doc) {
                            return [utils_1.DocumentType.FullInsurance, utils_1.DocumentType.FullInsuranceSecondary, utils_1.DocumentType.FullPhotoId].includes(doc.type);
                        });
                        documents.consentPdfUrls = z3Documents
                            .filter(function (doc) {
                            return doc.code === utils_1.PAPERWORK_CONSENT_CODING_LOINC.code ||
                                doc.code === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code ||
                                doc.code === utils_1.PRIVACY_POLICY_CODE;
                        })
                            .flatMap(function (doc) { return (doc.presignedUrl ? [doc.presignedUrl] : []); });
                    }
                    return [2 /*return*/, documents];
            }
        });
    });
}
function searchDocumentReferencesForVisit(oystehr, patientId, appointmentId) {
    return __awaiter(this, void 0, void 0, function () {
        var documentReferenceResources, docRefBundle, bundleEntries;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    documentReferenceResources = [];
                    return [4 /*yield*/, oystehr.fhir.batch({
                            requests: [
                                {
                                    // Consent
                                    method: 'GET',
                                    url: "/DocumentReference?status=current&_sort=-_lastUpdated&subject=Patient/".concat(patientId, "&related=Appointment/").concat(appointmentId, "&type=").concat(utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.system, "|").concat(utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code, ",").concat(utils_1.LOINC_SYSTEM, "|").concat(utils_1.PRIVACY_POLICY_CODE),
                                },
                                {
                                    // Photo IDs
                                    method: 'GET',
                                    url: "/DocumentReference?_sort=-_lastUpdated&status=current&related=Patient/".concat(patientId, "&type=").concat(utils_1.LOINC_SYSTEM, "|").concat(utils_1.PHOTO_ID_CARD_CODE),
                                },
                                {
                                    // Insurance Cards
                                    method: 'GET',
                                    url: "/DocumentReference?_sort=-_lastUpdated&status=current&related=Patient/".concat(patientId, "&type=").concat(utils_1.LOINC_SYSTEM, "|").concat(utils_1.INSURANCE_CARD_CODE),
                                },
                            ],
                        })];
                case 1:
                    docRefBundle = _a.sent();
                    bundleEntries = docRefBundle === null || docRefBundle === void 0 ? void 0 : docRefBundle.entry;
                    bundleEntries === null || bundleEntries === void 0 ? void 0 : bundleEntries.forEach(function (bundleEntry) {
                        var _a;
                        var bundleResource = bundleEntry.resource;
                        (_a = bundleResource.entry) === null || _a === void 0 ? void 0 : _a.forEach(function (entry) {
                            var docRefResource = entry.resource;
                            if (docRefResource) {
                                documentReferenceResources.push(docRefResource);
                            }
                        });
                    });
                    return [2 /*return*/, documentReferenceResources];
            }
        });
    });
}
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, patient, appointment, patientResource, encounterResource, selfPay;
    var _a, _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                appointmentId = input.appointmentId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: '_id', value: appointmentId },
                            { name: '_include', value: 'Appointment:patient' },
                            { name: '_revinclude', value: 'Encounter:appointment' },
                        ],
                    })];
            case 1:
                patient = _g.sent();
                appointment = (_b = (_a = patient.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Appointment'; })) === null || _b === void 0 ? void 0 : _b.resource;
                patientResource = (_d = (_c = patient.entry) === null || _c === void 0 ? void 0 : _c.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Patient'; })) === null || _d === void 0 ? void 0 : _d.resource;
                encounterResource = (_f = (_e = patient.entry) === null || _e === void 0 ? void 0 : _e.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Encounter'; })) === null || _f === void 0 ? void 0 : _f.resource;
                if (!appointment) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Appointment');
                }
                if (!patientResource || !patientResource.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Patient');
                }
                if (!encounterResource || !encounterResource.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Encounter');
                }
                selfPay = (0, utils_1.getPaymentVariantFromEncounter)(encounterResource) === utils_1.PaymentVariant.selfPay;
                return [2 /*return*/, {
                        appointmentId: appointmentId,
                        patientId: patientResource.id,
                        selfPay: selfPay,
                    }];
        }
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
    // at some point and it should always be available, so throwing it in the input interface anticipatorily
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var appointmentId = JSON.parse(input.body).appointmentId;
    if (!appointmentId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['appointmentId']);
    }
    if ((0, utils_1.isValidUUID)(appointmentId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('appointmentId');
    }
    return {
        secrets: secrets,
        userToken: userToken,
        appointmentId: appointmentId,
    };
};
