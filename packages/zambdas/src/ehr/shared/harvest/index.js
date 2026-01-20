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
exports.updateStripeCustomer = exports.updatePatientAccountFromQuestionnaire = exports.getAccountAndCoverageResourcesForPatient = exports.getCoverageUpdateResourcesFromUnbundled = exports.createContainedGuarantor = exports.relatedPersonsAreSame = exports.coveragesAreSame = exports.resolveGuarantor = exports.resolveCoverageUpdates = exports.createAccount = exports.getAccountOperations = exports.getSecondaryPolicyHolderFromAnswers = exports.getPrimaryPolicyHolderFromAnswers = exports.getCoverageResources = exports.createUpdatePharmacyPatchOps = exports.accountMatchesType = exports.PATIENT_CONTAINED_PHARMACY_ID = void 0;
exports.createConsentResources = createConsentResources;
exports.createDocumentResources = createDocumentResources;
exports.flagPaperworkEdit = flagPaperworkEdit;
exports.createMasterRecordPatchOperations = createMasterRecordPatchOperations;
exports.hasConflictingUpdates = hasConflictingUpdates;
exports.createConflictResolutionTask = createConflictResolutionTask;
exports.searchInsuranceInformation = searchInsuranceInformation;
exports.extractAccountGuarantor = extractAccountGuarantor;
exports.extractEmergencyContact = extractEmergencyContact;
exports.createErxContactOperation = createErxContactOperation;
var crypto_1 = require("crypto");
var lodash_1 = require("lodash");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var deduplicateUnbundledResources_1 = require("utils/lib/fhir/deduplicateUnbundledResources");
var sharedHelpers_1 = require("../../../patient/paperwork/sharedHelpers");
var shared_1 = require("../../../shared");
exports.PATIENT_CONTAINED_PHARMACY_ID = 'pharmacy';
var IGNORE_CREATING_TASKS_FOR_REVIEW = true;
// const PATIENT_UPDATE_MAX_RETRIES = 3;
var accountMatchesType = function (account, type) {
    var _a;
    if (!((_a = account === null || account === void 0 ? void 0 : account.type) === null || _a === void 0 ? void 0 : _a.coding) || !(type === null || type === void 0 ? void 0 : type.coding)) {
        return false;
    }
    var _loop_1 = function (targetCoding) {
        var matches = account.type.coding.some(function (accountCoding) { return accountCoding.code === targetCoding.code && accountCoding.system === targetCoding.system; });
        if (matches) {
            return { value: true };
        }
    };
    for (var _i = 0, _b = type.coding; _i < _b.length; _i++) {
        var targetCoding = _b[_i];
        var state_1 = _loop_1(targetCoding);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return false;
};
exports.accountMatchesType = accountMatchesType;
var organizationMatchesType = function (organization, type) {
    var _a;
    if (!((_a = organization === null || organization === void 0 ? void 0 : organization.type) === null || _a === void 0 ? void 0 : _a.length) || !(type === null || type === void 0 ? void 0 : type.coding)) {
        return false;
    }
    var _loop_2 = function (targetCoding) {
        var matches = organization.type.some(function (organizationType) {
            var _a;
            return (_a = organizationType.coding) === null || _a === void 0 ? void 0 : _a.some(function (organizationCoding) {
                return organizationCoding.code === targetCoding.code && organizationCoding.system === targetCoding.system;
            });
        });
        if (matches) {
            return { value: true };
        }
    };
    for (var _i = 0, _b = type.coding; _i < _b.length; _i++) {
        var targetCoding = _b[_i];
        var state_2 = _loop_2(targetCoding);
        if (typeof state_2 === "object")
            return state_2.value;
    }
    return false;
};
function createConsentResources(input) {
    return __awaiter(this, void 0, void 0, function () {
        var questionnaireResponse, patientResource, locationResource, appointmentId, oystehrAccessToken, oystehr, secrets, listResources, paperwork, flattenedPaperwork, consentSigner, oldConsentDocRefs, oldConsentResources, _a, consents, docRefs, _loop_3, _i, oldConsentDocRefs_1, oldDocRef, _loop_4, _b, _c, oldConsentResource, projectId, bucket, locationState, baseUploadURL, consentDocument, pdfsToCreate, pdfGroups, _d, pdfsToCreate_1, pdfInfo, typeCode, allDocRefsByType, nowIso, isVirtualLocation, facilityName, ipAddress, timezone, _loop_5, _e, pdfsToCreate_2, pdfInfo, _f, _g, _h, typeCode, group, files, docRefs, _loop_6, _j, pdfsToCreate_3, pdfInfo;
        var _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9;
        return __generator(this, function (_10) {
            switch (_10.label) {
                case 0:
                    questionnaireResponse = input.questionnaireResponse, patientResource = input.patientResource, locationResource = input.locationResource, appointmentId = input.appointmentId, oystehrAccessToken = input.oystehrAccessToken, oystehr = input.oystehr, secrets = input.secrets, listResources = input.listResources;
                    console.log('Checking DocumentReferences for consent forms');
                    paperwork = (_k = questionnaireResponse.item) !== null && _k !== void 0 ? _k : [];
                    flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(paperwork);
                    consentSigner = {
                        signature: (_o = (_m = (_l = flattenedPaperwork.find(function (item) { return item.linkId === 'signature'; })) === null || _l === void 0 ? void 0 : _l.answer) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.valueString,
                        fullName: (_r = (_q = (_p = flattenedPaperwork.find(function (question) { return question.linkId === 'full-name'; })) === null || _p === void 0 ? void 0 : _p.answer) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.valueString,
                        relationship: (_u = (_t = (_s = flattenedPaperwork.find(function (question) { return question.linkId === 'consent-form-signer-relationship'; })) === null || _s === void 0 ? void 0 : _s.answer) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.valueString,
                    };
                    console.log('consentSigner', consentSigner);
                    if (consentSigner.signature === undefined) {
                        throw new Error('Consent signature missing from QuestionnaireResponse');
                    }
                    if (consentSigner.fullName === undefined) {
                        throw new Error('Consent signer full name missing from QuestionnaireResponse');
                    }
                    if (consentSigner.relationship === undefined) {
                        throw new Error('Consent signer relationship missing from QuestionnaireResponse');
                    }
                    oldConsentDocRefs = undefined;
                    oldConsentResources = undefined;
                    if (!(questionnaireResponse && patientResource.id)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, utils_1.getConsentAndRelatedDocRefsForAppointment)({
                            appointmentId: appointmentId,
                            patientId: patientResource.id,
                        }, oystehr)];
                case 1:
                    _a = _10.sent(), consents = _a.consents, docRefs = _a.docRefs;
                    oldConsentResources = consents;
                    oldConsentDocRefs = docRefs;
                    _10.label = 2;
                case 2:
                    if (!(oldConsentDocRefs === null || oldConsentDocRefs === void 0 ? void 0 : oldConsentDocRefs.length)) return [3 /*break*/, 6];
                    _loop_3 = function (oldDocRef) {
                        return __generator(this, function (_11) {
                            switch (_11.label) {
                                case 0: return [4 /*yield*/, oystehr.fhir
                                        .patch({
                                        resourceType: 'DocumentReference',
                                        id: oldDocRef.id || '',
                                        operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
                                    })
                                        .catch(function (error) {
                                        throw new Error("Failed to update DocumentReference ".concat(oldDocRef.id, " status: ").concat(JSON.stringify(error)));
                                    })];
                                case 1:
                                    _11.sent();
                                    console.log("DocumentReference ".concat(oldDocRef.id, " status changed to superseded"));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, oldConsentDocRefs_1 = oldConsentDocRefs;
                    _10.label = 3;
                case 3:
                    if (!(_i < oldConsentDocRefs_1.length)) return [3 /*break*/, 6];
                    oldDocRef = oldConsentDocRefs_1[_i];
                    return [5 /*yield**/, _loop_3(oldDocRef)];
                case 4:
                    _10.sent();
                    _10.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    if (!(oldConsentResources === null || oldConsentResources === void 0 ? void 0 : oldConsentResources.length)) return [3 /*break*/, 10];
                    _loop_4 = function (oldConsentResource) {
                        return __generator(this, function (_12) {
                            switch (_12.label) {
                                case 0: return [4 /*yield*/, oystehr.fhir
                                        .patch({
                                        resourceType: 'Consent',
                                        id: oldConsentResource.id || '',
                                        operations: [
                                            {
                                                op: 'replace',
                                                path: '/status',
                                                value: 'inactive',
                                            },
                                        ],
                                    })
                                        .catch(function (error) {
                                        throw new Error("Failed to update Consent ".concat(oldConsentResource.id, " status: ").concat(JSON.stringify(error)));
                                    })];
                                case 1:
                                    _12.sent();
                                    console.log("Consent ".concat(oldConsentResource.id, " status changed to inactive"));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, _c = oldConsentResources || [];
                    _10.label = 7;
                case 7:
                    if (!(_b < _c.length)) return [3 /*break*/, 10];
                    oldConsentResource = _c[_b];
                    return [5 /*yield**/, _loop_4(oldConsentResource)];
                case 8:
                    _10.sent();
                    _10.label = 9;
                case 9:
                    _b++;
                    return [3 /*break*/, 7];
                case 10:
                    projectId = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets);
                    bucket = "".concat(projectId, "-consent-forms");
                    locationState = (_w = (_v = locationResource === null || locationResource === void 0 ? void 0 : locationResource.address) === null || _v === void 0 ? void 0 : _v.state) !== null && _w !== void 0 ? _w : 'NY';
                    baseUploadURL = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/z3/").concat(bucket, "/").concat(patientResource.id, "/").concat(Date.now());
                    consentDocument = locationState === 'IL'
                        ? './assets/CTT.and.Guarantee.of.Payment.and.Credit.Card.Agreement.Illinois-S.pdf'
                        : './assets/CTT.and.Guarantee.of.Payment.and.Credit.Card.Agreement-S.pdf';
                    pdfsToCreate = [
                        {
                            uploadURL: "".concat(baseUploadURL, "-consent-to-treat.pdf"),
                            copyFromPath: consentDocument,
                            formTitle: 'Consent to Treat, Guarantee of Payment & Card on File Agreement',
                            resourceTitle: 'Consent forms',
                            type: {
                                coding: [utils_1.PAPERWORK_CONSENT_CODING_LOINC, utils_1.PAPERWORK_CONSENT_CODE_UNIQUE],
                                text: 'Consent forms',
                            },
                        },
                        {
                            uploadURL: "".concat(baseUploadURL, "-hipaa-acknowledgement.pdf"),
                            copyFromPath: './assets/HIPAA.Acknowledgement-S.pdf',
                            formTitle: 'HIPAA Acknowledgement',
                            resourceTitle: 'HIPAA forms',
                            type: {
                                coding: [
                                    {
                                        system: 'http://loinc.org',
                                        code: utils_1.PRIVACY_POLICY_CODE,
                                        display: 'Privacy Policy',
                                    },
                                ],
                                text: 'HIPAA Acknowledgement forms',
                            },
                        },
                    ];
                    pdfGroups = {};
                    for (_d = 0, pdfsToCreate_1 = pdfsToCreate; _d < pdfsToCreate_1.length; _d++) {
                        pdfInfo = pdfsToCreate_1[_d];
                        typeCode = pdfInfo.type.coding[0].code;
                        if (pdfInfo.type.coding.length > 1) {
                            // Case of consent form with multiple type codings
                            typeCode = (_x = pdfInfo.type.coding.find(function (coding) {
                                return coding.system === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.system && coding.code === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code;
                            })) === null || _x === void 0 ? void 0 : _x.code;
                        }
                        if (!typeCode) {
                            throw new Error('Unexpectedly could not find type code for PAPERWORK_CONSENT_CODE_UNIQUE');
                        }
                        if (!pdfGroups[typeCode]) {
                            pdfGroups[typeCode] = [];
                        }
                        pdfGroups[typeCode].push(pdfInfo);
                    }
                    allDocRefsByType = {};
                    nowIso = luxon_1.DateTime.now().setZone('UTC').toISO() || '';
                    isVirtualLocation = ((_0 = (_z = (_y = locationResource === null || locationResource === void 0 ? void 0 : locationResource.extension) === null || _y === void 0 ? void 0 : _y.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release'; })) === null || _z === void 0 ? void 0 : _z.valueCoding) === null || _0 === void 0 ? void 0 : _0.code) === 'vi';
                    facilityName = isVirtualLocation
                        ? 'Ottehr Telemedicine'
                        : (_2 = (_1 = locationResource === null || locationResource === void 0 ? void 0 : locationResource.identifier) === null || _1 === void 0 ? void 0 : _1.find(function (identifierTemp) { return identifierTemp.system === "".concat(utils_1.FHIR_BASE_URL, "/r4/facility-name"); })) === null || _2 === void 0 ? void 0 : _2.value;
                    ipAddress = (_4 = (_3 = questionnaireResponse.extension) === null || _3 === void 0 ? void 0 : _3.find(function (ext) {
                        return ext.url === utils_1.FHIR_EXTENSION.Paperwork.submitterIP.url;
                    })) === null || _4 === void 0 ? void 0 : _4.valueString;
                    timezone = (_8 = (_7 = (_6 = (_5 = questionnaireResponse.item) === null || _5 === void 0 ? void 0 : _5.find(function (item) {
                        return item.linkId === 'signature-timezone';
                    })) === null || _6 === void 0 ? void 0 : _6.answer) === null || _7 === void 0 ? void 0 : _7[0]) === null || _8 === void 0 ? void 0 : _8.valueString;
                    _loop_5 = function (pdfInfo) {
                        var errMessage, pdfBytes;
                        return __generator(this, function (_13) {
                            switch (_13.label) {
                                case 0:
                                    console.log("creating ".concat(pdfInfo.formTitle, " PDF"), JSON.stringify(pdfInfo));
                                    errMessage = function (action, errorMsg) {
                                        return "Failed to ".concat(action, " ").concat(pdfInfo.formTitle, " PDF. ").concat(errorMsg);
                                    };
                                    console.log('getting pdf bytes');
                                    return [4 /*yield*/, (0, shared_1.createPdfBytes)(patientResource, consentSigner, nowIso.trim(), (_9 = ipAddress === null || ipAddress === void 0 ? void 0 : ipAddress.trim()) !== null && _9 !== void 0 ? _9 : '', pdfInfo, secrets, timezone === null || timezone === void 0 ? void 0 : timezone.trim(), facilityName).catch(function (error) {
                                            console.log('createPdfBytes error', error);
                                            throw new Error(errMessage('create', error.message));
                                        })];
                                case 1:
                                    pdfBytes = _13.sent();
                                    // fs.writeFileSync(`./consent-forms-${patientResource.id}.pdf`, pdfBytes);
                                    console.log('uploading pdf');
                                    return [4 /*yield*/, (0, utils_1.uploadPDF)(pdfBytes, pdfInfo.uploadURL, oystehrAccessToken, patientResource.id).catch(function (error) {
                                            throw new Error(errMessage('upload', error.message));
                                        })];
                                case 2:
                                    _13.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _e = 0, pdfsToCreate_2 = pdfsToCreate;
                    _10.label = 11;
                case 11:
                    if (!(_e < pdfsToCreate_2.length)) return [3 /*break*/, 14];
                    pdfInfo = pdfsToCreate_2[_e];
                    return [5 /*yield**/, _loop_5(pdfInfo)];
                case 12:
                    _10.sent();
                    _10.label = 13;
                case 13:
                    _e++;
                    return [3 /*break*/, 11];
                case 14:
                    console.log('pdfsToCreate len', pdfsToCreate.length);
                    _f = 0, _g = Object.entries(pdfGroups);
                    _10.label = 15;
                case 15:
                    if (!(_f < _g.length)) return [3 /*break*/, 18];
                    _h = _g[_f], typeCode = _h[0], group = _h[1];
                    files = group.map(function (pdf) { return ({
                        url: pdf.uploadURL,
                        title: pdf.formTitle,
                    }); });
                    return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                            files: files,
                            type: group[0].type,
                            dateCreated: nowIso,
                            oystehr: oystehr,
                            references: {
                                subject: { reference: "Patient/".concat(patientResource.id) },
                                context: { related: [{ reference: "Appointment/".concat(appointmentId) }] },
                            },
                            generateUUID: crypto_1.randomUUID,
                            listResources: listResources,
                            searchParams: [
                                {
                                    name: 'subject',
                                    value: "Patient/".concat(patientResource.id),
                                },
                                {
                                    name: 'related',
                                    value: "Appointment/".concat(appointmentId),
                                },
                            ],
                            meta: {
                                // for backward compatibility. TODO: remove this
                                tag: [{ code: utils_1.OTTEHR_MODULE.IP }, { code: utils_1.OTTEHR_MODULE.TM }],
                            },
                        })];
                case 16:
                    docRefs = (_10.sent()).docRefs;
                    allDocRefsByType[typeCode] = docRefs;
                    _10.label = 17;
                case 17:
                    _f++;
                    return [3 /*break*/, 15];
                case 18:
                    _loop_6 = function (pdfInfo) {
                        var typeCode, maybePaperworkTypeCoding, groupRefs, matchingRef;
                        return __generator(this, function (_14) {
                            switch (_14.label) {
                                case 0:
                                    typeCode = pdfInfo.type.coding[0].code;
                                    // only in the case of Consent DRs, we have introduced multiple codings so we can tell different kinds of Consents apart (labs vs paperwork)
                                    if (pdfInfo.type.coding.length > 1) {
                                        maybePaperworkTypeCoding = pdfInfo.type.coding.find(function (coding) {
                                            return coding.system === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.system && coding.code === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code;
                                        });
                                        if (maybePaperworkTypeCoding) {
                                            typeCode = maybePaperworkTypeCoding.code;
                                        }
                                    }
                                    if (!typeCode) {
                                        throw new Error('Unexpectedly could not find type code for PAPERWORK_CONSENT_CODE_UNIQUE');
                                    }
                                    groupRefs = allDocRefsByType[typeCode] || [];
                                    matchingRef = groupRefs.find(function (dr) { var _a; return ((_a = dr.content[0]) === null || _a === void 0 ? void 0 : _a.attachment.title) === pdfInfo.formTitle; });
                                    if (!(matchingRef === null || matchingRef === void 0 ? void 0 : matchingRef.id)) {
                                        throw new Error("DocumentReference for \"".concat(pdfInfo.formTitle, "\" not found"));
                                    }
                                    if (!(typeCode === utils_1.PAPERWORK_CONSENT_CODE_UNIQUE.code)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, (0, utils_1.createConsentResource)(patientResource.id, matchingRef.id, nowIso, oystehr)];
                                case 1:
                                    _14.sent();
                                    _14.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    _j = 0, pdfsToCreate_3 = pdfsToCreate;
                    _10.label = 19;
                case 19:
                    if (!(_j < pdfsToCreate_3.length)) return [3 /*break*/, 22];
                    pdfInfo = pdfsToCreate_3[_j];
                    return [5 /*yield**/, _loop_6(pdfInfo)];
                case 20:
                    _10.sent();
                    _10.label = 21;
                case 21:
                    _j++;
                    return [3 /*break*/, 19];
                case 22: return [2 /*return*/];
            }
        });
    });
}
var getAttachment = function (flattenedPaperwork, linkId) { var _a, _b, _c; return (_c = (_b = (_a = flattenedPaperwork.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueAttachment; };
function isNewAttachment(attachment, existing) {
    return !!attachment.url && !existing.has(attachment.url);
}
function isDefined(value) {
    return value !== undefined;
}
function filterNewAttachments(attachments, existing) {
    return attachments.filter(isDefined).filter(function (a) { return isNewAttachment(a, existing); });
}
function buildDocToSave(_a) {
    var _b, _c;
    var code = _a.code, attachments = _a.attachments, subject = _a.subject, context = _a.context, display = _a.display, text = _a.text;
    var sorted = sortAttachmentsByCreationTime(attachments);
    var dateCreated = (_c = (_b = sorted[0]) === null || _b === void 0 ? void 0 : _b.creation) !== null && _c !== void 0 ? _c : '';
    return {
        code: code,
        files: sorted.map(function (_a) {
            var _b = _a.url, url = _b === void 0 ? '' : _b, _c = _a.title, title = _c === void 0 ? '' : _c;
            return ({ url: url, title: title });
        }),
        references: {
            subject: { reference: subject },
            context: { related: [{ reference: context }] },
        },
        display: display,
        text: text,
        dateCreated: dateCreated,
    };
}
function createDocumentResources(questionnaireResponse, patientID, appointmentID, oystehr, listResources, documentReferenceResources) {
    return __awaiter(this, void 0, void 0, function () {
        var existingAttachments, _i, documentReferenceResources_1, doc, docsToSave, items, flattenedPaperwork, photoIdFront, photoIdBack, insuranceCardFront, insuranceCardBack, insuranceCardFrontSecondary, insuranceCardBackSecondary, patientConditionPhoto, schoolNote, workNote, idCards, insuranceCards, schoolWorkNotes, newListResources, _a, docsToSave_1, d, result;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    existingAttachments = new Set();
                    for (_i = 0, documentReferenceResources_1 = documentReferenceResources; _i < documentReferenceResources_1.length; _i++) {
                        doc = documentReferenceResources_1[_i];
                        (_b = doc.content) === null || _b === void 0 ? void 0 : _b.forEach(function (content) {
                            var _a;
                            var url = (_a = content.attachment) === null || _a === void 0 ? void 0 : _a.url;
                            if (url)
                                existingAttachments.add(url);
                        });
                    }
                    console.log('reviewing insurance cards and photo id cards');
                    docsToSave = [];
                    items = (_c = questionnaireResponse.item) !== null && _c !== void 0 ? _c : [];
                    flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(items);
                    photoIdFront = getAttachment(flattenedPaperwork, utils_1.PHOTO_ID_FRONT_ID);
                    photoIdBack = getAttachment(flattenedPaperwork, utils_1.PHOTO_ID_BACK_ID);
                    insuranceCardFront = getAttachment(flattenedPaperwork, utils_1.INSURANCE_CARD_FRONT_ID);
                    insuranceCardBack = getAttachment(flattenedPaperwork, utils_1.INSURANCE_CARD_BACK_ID);
                    insuranceCardFrontSecondary = getAttachment(flattenedPaperwork, utils_1.INSURANCE_CARD_FRONT_2_ID);
                    insuranceCardBackSecondary = getAttachment(flattenedPaperwork, utils_1.INSURANCE_CARD_BACK_2_ID);
                    patientConditionPhoto = getAttachment(flattenedPaperwork, "".concat(utils_1.PATIENT_PHOTO_ID_PREFIX, "s"));
                    schoolNote = getAttachment(flattenedPaperwork, utils_1.SCHOOL_WORK_NOTE_SCHOOL_ID);
                    workNote = getAttachment(flattenedPaperwork, utils_1.SCHOOL_WORK_NOTE_WORK_ID);
                    idCards = filterNewAttachments([photoIdFront, photoIdBack], existingAttachments);
                    insuranceCards = filterNewAttachments([insuranceCardFront, insuranceCardBack, insuranceCardFrontSecondary, insuranceCardBackSecondary], existingAttachments);
                    schoolWorkNotes = filterNewAttachments([schoolNote, workNote], existingAttachments);
                    if (idCards.length) {
                        docsToSave.push(buildDocToSave({
                            code: utils_1.PHOTO_ID_CARD_CODE,
                            attachments: idCards,
                            subject: "Patient/".concat(patientID),
                            context: "Patient/".concat(patientID),
                            display: 'Patient data Document',
                            text: 'Photo ID cards',
                        }));
                    }
                    if (insuranceCards.length) {
                        docsToSave.push(buildDocToSave({
                            code: utils_1.INSURANCE_CARD_CODE,
                            attachments: insuranceCards,
                            subject: "Patient/".concat(patientID),
                            context: "Patient/".concat(patientID),
                            display: 'Health insurance card',
                            text: 'Insurance cards',
                        }));
                    }
                    if (patientConditionPhoto) {
                        if (!existingAttachments.has((_d = patientConditionPhoto.url) !== null && _d !== void 0 ? _d : '')) {
                            docsToSave.push(buildDocToSave({
                                code: utils_1.PATIENT_PHOTO_CODE,
                                attachments: [patientConditionPhoto],
                                subject: "Patient/".concat(patientID),
                                context: "Appointment/".concat(appointmentID),
                                display: 'Patient condition photos',
                                text: 'Patient photos',
                            }));
                        }
                    }
                    if (schoolWorkNotes.length) {
                        docsToSave.push(buildDocToSave({
                            code: utils_1.SCHOOL_WORK_NOTE_TEMPLATE_CODE,
                            attachments: schoolWorkNotes,
                            subject: "Patient/".concat(patientID),
                            context: "Appointment/".concat(appointmentID),
                            display: 'Patient status assessment note template',
                            text: 'Patient status assessment note template',
                        }));
                    }
                    if (docsToSave.length === 0) {
                        console.log('No new documents to save. Skipping document creation.');
                        return [2 /*return*/];
                    }
                    console.log('docsToSave len', docsToSave.length);
                    newListResources = listResources;
                    _a = 0, docsToSave_1 = docsToSave;
                    _f.label = 1;
                case 1:
                    if (!(_a < docsToSave_1.length)) return [3 /*break*/, 4];
                    d = docsToSave_1[_a];
                    return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                            files: d.files,
                            type: {
                                coding: [
                                    {
                                        system: 'http://loinc.org',
                                        code: d.code,
                                        display: d.display,
                                    },
                                ],
                                text: d.text,
                            },
                            dateCreated: d.dateCreated,
                            searchParams: [
                                {
                                    name: 'subject',
                                    value: "Patient/".concat(patientID),
                                },
                                {
                                    name: 'type',
                                    value: d.code,
                                },
                                {
                                    name: 'related',
                                    value: "Appointment/".concat(appointmentID),
                                },
                            ],
                            references: d.references,
                            oystehr: oystehr,
                            generateUUID: crypto_1.randomUUID,
                            listResources: newListResources,
                            meta: {
                                // for backward compatibility. TODO: remove this
                                tag: [{ code: utils_1.OTTEHR_MODULE.IP }, { code: utils_1.OTTEHR_MODULE.TM }],
                            },
                        })];
                case 2:
                    result = _f.sent();
                    newListResources = (_e = result.listResources) !== null && _e !== void 0 ? _e : listResources;
                    _f.label = 3;
                case 3:
                    _a++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function flagPaperworkEdit(patientID, encounterID, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var now, existingFlags, activeFlags;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = luxon_1.DateTime.now().toUTC().toISO();
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Flag',
                            params: [
                                {
                                    name: 'encounter',
                                    value: "Encounter/".concat(encounterID),
                                },
                                {
                                    name: '_tag',
                                    value: 'paperwork-edit',
                                },
                                {
                                    name: '_sort',
                                    value: '-date',
                                },
                            ],
                        })];
                case 1:
                    existingFlags = (_a.sent()).unbundle();
                    activeFlags = existingFlags.filter(function (flag) { return flag.status === 'active'; });
                    return [4 /*yield*/, (0, sharedHelpers_1.createOrUpdateFlags)('paperwork-edit', activeFlags, patientID, encounterID, now, oystehr)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var sortAttachmentsByCreationTime = function (attachments) {
    return attachments.sort(function (a1, a2) {
        var creation1 = a1.creation;
        var creation2 = a2.creation;
        if (!creation1 && !creation2) {
            return 0;
        }
        else if (!creation1) {
            return 1;
        }
        else if (!creation2) {
            return -1;
        }
        var date1 = luxon_1.DateTime.fromISO(creation1);
        var date2 = luxon_1.DateTime.fromISO(creation2);
        if (!date1.isValid && !date2.isValid) {
            return 0;
        }
        else if (!date1.isValid) {
            return 1;
        }
        else if (!date2.isValid) {
            return -1;
        }
        if (date1 === date2) {
            return 0;
        }
        return date1 < date2 ? -1 : 1;
    });
};
var paperworkToPatientFieldMap = {
    'patient-first-name': utils_1.patientFieldPaths.firstName,
    'patient-middle-name': utils_1.patientFieldPaths.middleName,
    'patient-last-name': utils_1.patientFieldPaths.lastName,
    'patient-birthdate': utils_1.patientFieldPaths.birthDate,
    'patient-pronouns': utils_1.patientFieldPaths.preferredPronouns,
    'patient-pronouns-custom': utils_1.patientFieldPaths.preferredPronounsCustom,
    'patient-name-suffix': utils_1.patientFieldPaths.suffix,
    'patient-preferred-name': utils_1.patientFieldPaths.preferredName,
    'patient-birth-sex': utils_1.patientFieldPaths.gender,
    'patient-number': utils_1.patientFieldPaths.phone,
    'patient-email': utils_1.patientFieldPaths.email,
    'preferred-language': utils_1.patientFieldPaths.preferredLanguage,
    'pcp-first': utils_1.patientFieldPaths.pcpFirstName,
    'pcp-last': utils_1.patientFieldPaths.pcpLastName,
    'pcp-number': utils_1.patientFieldPaths.pcpPhone,
    'pcp-practice': utils_1.patientFieldPaths.practiceName,
    'pcp-address': utils_1.patientFieldPaths.pcpStreetAddress,
    'patient-street-address': utils_1.patientFieldPaths.streetAddress,
    'patient-street-address-2': utils_1.patientFieldPaths.streetAddressLine2,
    'patient-city': utils_1.patientFieldPaths.city,
    'patient-state': utils_1.patientFieldPaths.state,
    'patient-zip': utils_1.patientFieldPaths.zip,
    'patient-filling-out-as': utils_1.patientFieldPaths.fillingOutAs,
    'guardian-email': utils_1.patientFieldPaths.parentGuardianEmail,
    'guardian-number': utils_1.patientFieldPaths.parentGuardianPhone,
    'patient-ethnicity': utils_1.patientFieldPaths.ethnicity,
    'patient-race': utils_1.patientFieldPaths.race,
    'patient-gender-identity': utils_1.patientFieldPaths.genderIdentity,
    'patient-gender-identity-details': utils_1.patientFieldPaths.genderIdentityDetails,
    'patient-sexual-orientation': utils_1.patientFieldPaths.sexualOrientation,
    'patient-point-of-discovery': utils_1.patientFieldPaths.pointOfDiscovery,
    'mobile-opt-in': utils_1.patientFieldPaths.sendMarketing,
    'common-well-consent': utils_1.patientFieldPaths.commonWellConsent,
    'patient-preferred-communication-method': utils_1.patientFieldPaths.preferredCommunicationMethod,
    'insurance-carrier': utils_1.coverageFieldPaths.carrier,
    'insurance-member-id': utils_1.coverageFieldPaths.memberId,
    'insurance-additional-information': utils_1.coverageFieldPaths.additionalInformation,
    'policy-holder-first-name': utils_1.relatedPersonFieldPaths.firstName,
    'policy-holder-middle-name': utils_1.relatedPersonFieldPaths.middleName,
    'policy-holder-last-name': utils_1.relatedPersonFieldPaths.lastName,
    'policy-holder-date-of-birth': utils_1.relatedPersonFieldPaths.birthDate,
    'policy-holder-birth-sex': utils_1.relatedPersonFieldPaths.gender,
    'policy-holder-address-as-patient': utils_1.relatedPersonFieldPaths.sameAsPatientAddress,
    'policy-holder-address': utils_1.relatedPersonFieldPaths.streetAddress,
    'policy-holder-address-additional-line': utils_1.relatedPersonFieldPaths.addressLine2,
    'policy-holder-city': utils_1.relatedPersonFieldPaths.city,
    'policy-holder-state': utils_1.relatedPersonFieldPaths.state,
    'policy-holder-zip': utils_1.relatedPersonFieldPaths.zip,
    'patient-relationship-to-insured': utils_1.coverageFieldPaths.relationship,
};
var pathToLinkIdMap = Object.entries(paperworkToPatientFieldMap).reduce(function (acc, _a) {
    var linkId = _a[0], path = _a[1];
    acc[path] = linkId;
    return acc;
}, {});
var BIRTH_SEX_MAP = {
    Male: 'male',
    Female: 'female',
    Intersex: 'other',
};
var PCP_FIELDS = ['pcp-first', 'pcp-last', 'pcp-practice', 'pcp-address', 'pcp-number', 'pcp-active'];
function createMasterRecordPatchOperations(questionnaireResponseItems, patient, questionnaireForEnableWhenFiltering) {
    var _a;
    var flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(questionnaireResponseItems);
    // Filter out items that should be hidden based on enableWhen conditions
    if (questionnaireForEnableWhenFiltering) {
        flattenedPaperwork = (0, utils_1.filterQuestionnaireResponseByEnableWhen)(flattenedPaperwork, questionnaireForEnableWhenFiltering);
    }
    var result = {
        patient: { patchOpsForDirectUpdate: [], conflictingUpdates: [] },
        coverage: {},
        relatedPerson: {},
    };
    var tempOperations = {
        patient: [],
        coverage: {},
        relatedPerson: {},
    };
    // Define telecom configurations
    var contactTelecomConfigs = {
        'patient-number': { system: 'phone' },
        'patient-email': { system: 'email' },
        'guardian-number': { system: 'phone' },
        'guardian-email': { system: 'email' },
        'responsible-party-number': { system: 'phone', use: 'mobile' },
        'responsible-party-email': { system: 'email' },
        'pcp-number': { system: 'phone' },
        'emergency-contact-number': { system: 'phone' },
    };
    var pcpItems = [];
    var isUseMissedInPatientName = false;
    flattenedPaperwork.forEach(function (item) {
        var _a, _b, _c, _d, _e;
        var value = extractValueFromItem(item);
        var isAnswerEmpty = value === undefined || value === '';
        if (PCP_FIELDS.includes(item.linkId)) {
            pcpItems.push(item);
            return;
        }
        // Remove '-2' suffix for secondary fields
        var baseFieldId = item.linkId === 'patient-street-address-2' ? item.linkId : item.linkId.replace(/-2$/, '');
        var fullPath = paperworkToPatientFieldMap[baseFieldId];
        if (!fullPath)
            return;
        // Change index if path is changeable
        if (['patient-first-name', 'patient-last-name'].includes(baseFieldId)) {
            var nameIndex = (_a = patient.name) === null || _a === void 0 ? void 0 : _a.findIndex(function (name) { return name.use === 'official'; });
            isUseMissedInPatientName = nameIndex === -1;
            if (isUseMissedInPatientName) {
                nameIndex = 0;
            }
            fullPath = fullPath.replace(/name\/\d+/, "name/".concat(nameIndex));
        }
        var _f = (0, utils_1.extractResourceTypeAndPath)(fullPath), resourceType = _f.resourceType, path = _f.path;
        var shouldThrow = path.includes('contact') || fullPath.includes('contact');
        if (shouldThrow) {
            throw new Error("SHORT CIRCUIT: trigger occurs");
        }
        switch (resourceType) {
            case 'Patient': {
                // Handle telecom fields
                var contactTelecomConfig = contactTelecomConfigs[item.linkId];
                if (contactTelecomConfig) {
                    if (isAnswerEmpty) {
                        var operation_1 = (0, utils_1.createPatchOperationForTelecom)(contactTelecomConfig, patient, path, undefined);
                        if (operation_1)
                            tempOperations.patient.push(operation_1);
                        return;
                    }
                    var operation = (0, utils_1.createPatchOperationForTelecom)(contactTelecomConfig, patient, path, value);
                    if (operation)
                        tempOperations.patient.push(operation);
                    return;
                }
                // Handle extensions
                if (path.startsWith('/extension/')) {
                    var url = path.replace('/extension/', '');
                    var currentValue_1 = (0, utils_1.getCurrentValue)(patient, path);
                    if (value !== currentValue_1) {
                        var operation = void 0;
                        if (isAnswerEmpty) {
                            if (currentValue_1 !== undefined && currentValue_1 !== null) {
                                operation = (0, utils_1.getPatchOperationToRemoveExtension)(patient, { url: url });
                            }
                        }
                        else {
                            operation = (0, utils_1.getPatchOperationToAddOrUpdateExtension)(patient, { url: url, value: String(value) }, currentValue_1);
                        }
                        if (operation)
                            tempOperations.patient.push(operation);
                    }
                    return;
                }
                // Special handler for preferred-language
                if (item.linkId === 'preferred-language') {
                    var currentValue_2 = (_d = (_c = (_b = patient.communication) === null || _b === void 0 ? void 0 : _b.find(function (lang) { return lang.preferred; })) === null || _c === void 0 ? void 0 : _c.language.coding) === null || _d === void 0 ? void 0 : _d[0].display;
                    var otherItem = flattenedPaperwork.find(function (item) { return item.linkId === 'other-preferred-language'; });
                    var otherValue = otherItem ? extractValueFromItem(otherItem) : undefined;
                    var newValue = value === 'Other' ? otherValue : value;
                    if (!newValue || newValue === '') {
                        if (currentValue_2) {
                            var operation = (0, utils_1.getPatchOperationToRemovePreferredLanguage)(patient);
                            if (operation)
                                tempOperations.patient.push(operation);
                        }
                        return;
                    }
                    else if (newValue !== currentValue_2) {
                        var operation = (0, utils_1.getPatchOperationToAddOrUpdatePreferredLanguage)(newValue, path, patient, currentValue_2);
                        tempOperations.patient.push(operation);
                    }
                    return;
                }
                if (item.linkId === 'patient-preferred-name') {
                    var preferredNameIndex = (_e = patient.name) === null || _e === void 0 ? void 0 : _e.findIndex(function (name) { return name.use === 'nickname'; });
                    var currentPath = path.replace(/name\/\d+/, "name/".concat(preferredNameIndex));
                    var currentValue_3 = (0, utils_1.getCurrentValue)(patient, currentPath);
                    if (value !== currentValue_3) {
                        var operation = (0, utils_1.getPatchOperationToAddOrUpdatePreferredName)(currentPath, currentValue_3, value);
                        if (operation)
                            tempOperations.patient.push(operation);
                    }
                    return;
                }
                // Handle array fields
                var _g = (0, utils_1.getArrayInfo)(path), isArray = _g.isArray, parentPath = _g.parentPath;
                if (isArray) {
                    var effectiveArrayValue = getEffectiveValue(patient, parentPath, tempOperations.patient);
                    if (isAnswerEmpty) {
                        if (!effectiveArrayValue)
                            return undefined;
                    }
                    if (effectiveArrayValue === undefined) {
                        var currentParentValue = (0, utils_1.getCurrentValue)(patient, parentPath);
                        var operation = createBasicPatchOperation([value], parentPath, currentParentValue);
                        if (operation)
                            tempOperations.patient.push(operation);
                        return;
                    }
                    var arrayMatch = path.match(/^(.+)\/(\d+)$/);
                    if (arrayMatch) {
                        var arrayPath = arrayMatch[1], indexStr = arrayMatch[2];
                        var targetIndex = parseInt(indexStr);
                        var currentArray_1 = Array.isArray(effectiveArrayValue)
                            ? __spreadArray([], effectiveArrayValue, true) : new Array(targetIndex + 1).fill(undefined);
                        if (value === '') {
                            currentArray_1[targetIndex] = undefined;
                        }
                        else {
                            currentArray_1[targetIndex] = value;
                        }
                        var cleanArray = currentArray_1.filter(function (item, index) { return item !== undefined || index < currentArray_1.length - 1; });
                        if (effectiveArrayValue === undefined || areArraysDifferent(effectiveArrayValue, cleanArray)) {
                            var operation = cleanArray.length > 0
                                ? {
                                    op: effectiveArrayValue === undefined ? 'add' : 'replace',
                                    path: arrayPath,
                                    value: cleanArray,
                                }
                                : {
                                    op: 'remove',
                                    path: arrayPath,
                                };
                            tempOperations.patient.push(operation);
                        }
                    }
                    return;
                }
                // Handle regular fields
                var currentValue = (0, utils_1.getCurrentValue)(patient, path);
                if (value !== currentValue) {
                    if (isAnswerEmpty) {
                        if (currentValue !== undefined && currentValue !== null) {
                            var removeOp = {
                                op: 'remove',
                                path: path,
                            };
                            tempOperations.patient.push(removeOp);
                        }
                    }
                    else {
                        var operation = createBasicPatchOperation(value, path, currentValue);
                        if (operation)
                            tempOperations.patient.push(operation);
                    }
                }
                return;
            }
            default: {
                return;
            }
        }
    });
    if (isUseMissedInPatientName) {
        tempOperations.patient.push({
            op: 'add',
            path: '/name/0/use',
            value: 'official',
        });
    }
    // Separate operations for each resource
    // Separate Patient operations
    result.patient = separateResourceUpdates(tempOperations.patient, patient, 'Patient');
    result.patient.patchOpsForDirectUpdate = result.patient.patchOpsForDirectUpdate.filter(function (op) {
        var path = op.path, innerOperation = op.op;
        return path != undefined && innerOperation != undefined;
    });
    result.patient.patchOpsForDirectUpdate = (0, utils_1.consolidateOperations)(result.patient.patchOpsForDirectUpdate, patient);
    // this needs to go here for now because consolidateOperations breaks it
    (_a = result.patient.patchOpsForDirectUpdate).push.apply(_a, getPCPPatchOps(pcpItems, patient));
    console.log('result.patient.patchOps', JSON.stringify(result.patient.patchOpsForDirectUpdate, null, 2));
    return result;
}
var getPCPPatchOps = function (flattenedItems, patient) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    var isActive = (_c = (_b = (_a = flattenedItems.find(function (field) { return field.linkId === 'pcp-active'; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueBoolean;
    var firstName = (_f = (_e = (_d = flattenedItems.find(function (field) { return field.linkId === 'pcp-first'; })) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString;
    var lastName = (_j = (_h = (_g = flattenedItems.find(function (field) { return field.linkId === 'pcp-last'; })) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    var practiceName = (_m = (_l = (_k = flattenedItems.find(function (field) { return field.linkId === 'pcp-practice'; })) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString;
    var pcpAddress = (_q = (_p = (_o = flattenedItems.find(function (field) { return field.linkId === 'pcp-address'; })) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
    var phone = (_t = (_s = (_r = flattenedItems.find(function (field) { return field.linkId === 'pcp-number'; })) === null || _r === void 0 ? void 0 : _r.answer) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.valueString;
    console.log('pcp patch inputs', isActive, firstName, lastName, practiceName, pcpAddress, phone);
    var pcpActiveFieldExists = flattenedItems.some(function (field) { return field.linkId === 'pcp-active'; });
    var shouldDeactivate = isActive === false || (pcpActiveFieldExists && isActive === undefined);
    var hasSomeValue = (firstName && lastName) || practiceName || pcpAddress || phone;
    var hasAnyPCPFields = flattenedItems.some(function (field) { return PCP_FIELDS.includes(field.linkId); });
    var shouldClearAllData = hasAnyPCPFields && !hasSomeValue;
    if (!shouldDeactivate && !hasSomeValue) {
        return [];
    }
    var operations = [];
    var currentPCPRef = (_u = patient.generalPractitioner) === null || _u === void 0 ? void 0 : _u[0];
    var currentContainedPCP = (currentPCPRef === null || currentPCPRef === void 0 ? void 0 : currentPCPRef.reference)
        ? (_v = patient.contained) === null || _v === void 0 ? void 0 : _v.find(function (resource) { return "#".concat(resource.id) === (currentPCPRef === null || currentPCPRef === void 0 ? void 0 : currentPCPRef.reference) && resource.resourceType === 'Practitioner'; })
        : undefined;
    if (shouldClearAllData) {
        if (currentPCPRef) {
            operations.push({
                op: 'remove',
                path: '/generalPractitioner',
            });
        }
        if (currentContainedPCP) {
            var contained = ((_w = patient.contained) !== null && _w !== void 0 ? _w : []).filter(function (resource) { return resource.id !== currentContainedPCP.id; });
            if (contained.length == 0) {
                operations.push({
                    op: 'remove',
                    path: '/contained',
                });
            }
            else {
                operations.push({
                    op: 'replace',
                    path: '/contained',
                    value: contained,
                });
            }
        }
    }
    else {
        var name_1;
        var telecom = void 0;
        var address = void 0;
        var extension = void 0;
        if (lastName) {
            name_1 = [{ family: lastName }];
            if (firstName) {
                name_1[0].given = [firstName];
            }
        }
        if (phone) {
            telecom = [{ system: 'phone', value: (0, utils_1.formatPhoneNumber)(phone) }];
        }
        if (pcpAddress) {
            address = [{ text: pcpAddress }];
        }
        if (practiceName) {
            extension = [
                {
                    url: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/practice-name"),
                    valueString: practiceName,
                },
            ];
        }
        var newPCP_1 = {
            resourceType: 'Practitioner',
            id: 'primary-care-physician',
            name: name_1,
            telecom: telecom,
            address: address,
            extension: extension,
            active: !shouldDeactivate,
        };
        if (lodash_1.default.isEqual(newPCP_1, currentContainedPCP)) {
            return operations;
        }
        var existingContained = (_x = patient.contained) !== null && _x !== void 0 ? _x : [];
        var newContained = currentContainedPCP
            ? existingContained.map(function (resource) {
                if (resource.id === currentContainedPCP.id) {
                    return newPCP_1;
                }
                return resource;
            })
            : __spreadArray(__spreadArray([], existingContained.filter(function (resource) { return resource.id !== newPCP_1.id; }), true), [newPCP_1], false);
        operations.push({
            op: patient.contained != undefined ? 'replace' : 'add',
            path: '/contained',
            value: newContained,
        });
        if ((currentPCPRef === null || currentPCPRef === void 0 ? void 0 : currentPCPRef.reference) !== "#".concat(newPCP_1.id)) {
            operations.push({
                op: currentPCPRef ? 'replace' : 'add',
                path: '/generalPractitioner',
                value: [{ reference: "#".concat(newPCP_1.id), resourceType: 'Practitioner' }],
            });
        }
    }
    return operations;
};
var createUpdatePharmacyPatchOps = function (patient, flattenedItems) {
    var _a, _b, _c, _d;
    var pharmacyNameAnswer = getAnswer('pharmacy-name', flattenedItems);
    var pharmacyAddressAnswer = getAnswer('pharmacy-address', flattenedItems);
    // Check if pharmacy fields are present in the questionnaire response
    var hasPharmacyFields = pharmacyNameAnswer !== undefined || pharmacyAddressAnswer !== undefined;
    // Check if patient currently has pharmacy data
    var hasExistingPharmacy = ((_a = patient.contained) === null || _a === void 0 ? void 0 : _a.some(function (resource) { return resource.id === exports.PATIENT_CONTAINED_PHARMACY_ID; })) ||
        ((_b = patient.extension) === null || _b === void 0 ? void 0 : _b.some(function (extension) { return extension.url === utils_1.PREFERRED_PHARMACY_EXTENSION_URL; }));
    // If no pharmacy fields in questionnaire and no existing pharmacy, no action needed
    if (!hasPharmacyFields && !hasExistingPharmacy) {
        return [];
    }
    var inputPharmacyName = pharmacyNameAnswer === null || pharmacyNameAnswer === void 0 ? void 0 : pharmacyNameAnswer.valueString;
    var inputPharmacyAddress = pharmacyAddressAnswer === null || pharmacyAddressAnswer === void 0 ? void 0 : pharmacyAddressAnswer.valueString;
    var operations = [];
    var currentContained = (_c = patient.contained) !== null && _c !== void 0 ? _c : [];
    var filteredContained = currentContained.filter(function (resource) { return resource.id !== exports.PATIENT_CONTAINED_PHARMACY_ID; });
    // Add new pharmacy if provided
    if (inputPharmacyName || inputPharmacyAddress) {
        filteredContained.push({
            resourceType: 'Organization',
            id: exports.PATIENT_CONTAINED_PHARMACY_ID,
            name: inputPharmacyName !== null && inputPharmacyName !== void 0 ? inputPharmacyName : '-',
            type: [(0, utils_1.codeableConcept)('pharmacy', utils_1.FHIR_EXTENSION.Organization.organizationType.url)],
            address: inputPharmacyAddress
                ? [
                    {
                        text: inputPharmacyAddress,
                    },
                ]
                : undefined,
        });
    }
    // Create contained operation
    if (patient.contained || filteredContained.length > 0) {
        if (filteredContained.length === 0) {
            operations.push({
                op: 'remove',
                path: '/contained',
            });
        }
        else {
            operations.push({
                op: patient.contained ? 'replace' : 'add',
                path: '/contained',
                value: filteredContained,
            });
        }
    }
    // Handle extension
    var currentExtensions = (_d = patient.extension) !== null && _d !== void 0 ? _d : [];
    var filteredExtensions = currentExtensions.filter(function (extension) { return extension.url !== utils_1.PREFERRED_PHARMACY_EXTENSION_URL; });
    // Add pharmacy reference if we have pharmacy data
    if (inputPharmacyName || inputPharmacyAddress) {
        filteredExtensions.push({
            url: utils_1.PREFERRED_PHARMACY_EXTENSION_URL,
            valueReference: {
                reference: '#' + exports.PATIENT_CONTAINED_PHARMACY_ID,
            },
        });
    }
    // Create extension operation
    if (patient.extension || filteredExtensions.length > 0) {
        if (filteredExtensions.length === 0) {
            operations.push({
                op: 'remove',
                path: '/extension',
            });
        }
        else {
            operations.push({
                op: patient.extension ? 'replace' : 'add',
                path: '/extension',
                value: filteredExtensions,
            });
        }
    }
    return operations;
};
exports.createUpdatePharmacyPatchOps = createUpdatePharmacyPatchOps;
function separateResourceUpdates(patchOps, resource, resourceType) {
    var patchOpsForDirectUpdate = [];
    var conflictingUpdates = [];
    patchOps.forEach(function (patchOp) {
        if (patchOp.op === 'add' || IGNORE_CREATING_TASKS_FOR_REVIEW) {
            patchOpsForDirectUpdate.push(patchOp);
        }
        else {
            var currentValue = (0, utils_1.getCurrentValue)(resource, patchOp.path);
            if (!currentValue || currentValue === '') {
                patchOpsForDirectUpdate.push(patchOp);
            }
            else {
                conflictingUpdates.push({
                    operation: patchOp,
                    resourceReference: "".concat(resourceType, "/").concat(resource.id),
                });
            }
        }
    });
    return { patchOpsForDirectUpdate: patchOpsForDirectUpdate, conflictingUpdates: conflictingUpdates };
}
function hasConflictingUpdates(operations) {
    return (operations.patient.conflictingUpdates.length > 0 ||
        Object.values(operations.coverage).some(function (ops) { return ops.conflictingUpdates.length > 0; }) ||
        Object.values(operations.relatedPerson).some(function (ops) { return ops.conflictingUpdates.length > 0; }));
}
function createBasicPatchOperation(value, path, currentValue) {
    if (!value || value === '') {
        return currentValue !== undefined ? { op: 'remove', path: path } : undefined;
    }
    return {
        op: currentValue === undefined ? 'add' : 'replace',
        path: path,
        value: value,
    };
}
function extractValueFromItem(item
// insurancePlanResources?: InsurancePlan[],
// organizationResources?: Organization[]
) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // Handle date components collection
    if (item === null || item === void 0 ? void 0 : item.item) {
        var hasDateComponents = item.item.some(function (i) { return i.linkId.includes('-dob-year') || i.linkId.includes('-dob-month') || i.linkId.includes('-dob-day'); });
        if (hasDateComponents) {
            var dateComponents = {
                year: ((_c = (_b = (_a = item.item.find(function (i) { return i.linkId.includes('-dob-year'); })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString) || '',
                month: ((_f = (_e = (_d = item.item.find(function (i) { return i.linkId.includes('-dob-month'); })) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString) || '',
                day: ((_j = (_h = (_g = item.item.find(function (i) { return i.linkId.includes('-dob-day'); })) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString) || '',
            };
            return (0, utils_1.isoStringFromDateComponents)(dateComponents);
        }
    }
    var answer = (_k = item.answer) === null || _k === void 0 ? void 0 : _k[0];
    // Handle gender answers
    if (item.linkId.includes('-birth-sex') && (answer === null || answer === void 0 ? void 0 : answer.valueString)) {
        return BIRTH_SEX_MAP[answer.valueString];
    }
    // Handle regular answers
    if (!answer)
        return undefined;
    if ('valueString' in answer)
        return answer.valueString;
    if ('valueBoolean' in answer)
        return answer.valueBoolean;
    if ('valueDateTime' in answer)
        return answer.valueDateTime;
    if ('valueReference' in answer)
        return answer.valueReference;
    return undefined;
}
function getEffectiveValue(resource, path, patchOperations) {
    var effectiveValue = (0, utils_1.getCurrentValue)(resource, path);
    patchOperations.forEach(function (operation) {
        if (operation.path === path) {
            switch (operation.op) {
                case 'remove':
                    effectiveValue = undefined;
                    break;
                case 'replace':
                case 'add':
                    effectiveValue = operation.value;
                    break;
            }
        }
    });
    return effectiveValue;
}
function createConflictResolutionTask(operations, resources, qrId) {
    // Collect all conflicts with resource context
    var allConflicts = __spreadArray(__spreadArray(__spreadArray([], operations.patient.conflictingUpdates.map(function (conflict) { return (__assign(__assign({}, conflict), { resourceType: 'Patient', resourceId: resources.patient.id })); }), true), Object.entries(operations.coverage).flatMap(function (_a) {
        var coverageId = _a[0], ops = _a[1];
        return ops.conflictingUpdates.map(function (conflict) { return (__assign(__assign({}, conflict), { resourceType: 'Coverage', resourceId: coverageId })); });
    }), true), Object.entries(operations.relatedPerson).flatMap(function (_a) {
        var relatedPersonId = _a[0], ops = _a[1];
        return ops.conflictingUpdates.map(function (conflict) { return (__assign(__assign({}, conflict), { resourceType: 'RelatedPerson', resourceId: relatedPersonId })); });
    }), true);
    return {
        resourceType: 'Task',
        status: 'ready',
        intent: 'order',
        description: 'Patient master record information changes',
        requester: {
            type: 'Patient',
            reference: "Patient/".concat(resources.patient.id),
        },
        input: allConflicts.map(function (conflict) { return ({
            type: {
                text: getFieldNameWithResource(resources, conflict.resourceType, conflict.resourceId, conflict.operation.path),
            },
            valueString: JSON.stringify({
                operation: conflict.operation,
                resourceReference: conflict.resourceReference,
            }),
        }); }),
        focus: {
            type: 'QuestionnaireResponse',
            reference: "QuestionnaireResponse/".concat(qrId),
        },
    };
}
function getFieldNameWithResource(resources, resourceType, _resourceId, path) {
    var resource;
    switch (resourceType) {
        case 'Patient':
            resource = resources.patient;
            break;
    }
    if (!resource) {
        return "Unknown field in ".concat(resourceType);
    }
    // Get human-readable field name
    var fullPath = "".concat(resourceType).concat(path);
    var fieldName = getFieldName(resource, fullPath);
    // Add context about which resource it belongs to
    switch (resourceType) {
        case 'Patient':
            return "Patient: ".concat(fieldName);
        case 'Coverage': {
            var coverage = resource;
            var coverageContext = coverage.order === 1 ? 'Primary' : 'Secondary';
            return "".concat(coverageContext, " Coverage: ").concat(fieldName);
        }
        case 'RelatedPerson':
            return "Related Person: ".concat(fieldName);
        default:
            return fieldName;
    }
}
function getFieldName(resource, path) {
    var _a;
    if (path.includes('/extension/')) {
        var extensionIndex = path.replace('/extension/', '');
        if (!isNaN(Number(extensionIndex))) {
            var extension = (_a = resource.extension) === null || _a === void 0 ? void 0 : _a[Number(extensionIndex)];
            if (extension === null || extension === void 0 ? void 0 : extension.url) {
                path = "".concat(resource.resourceType, "/extension/").concat(extension.url);
            }
        }
    }
    return pathToLinkIdMap[path] || 'unknown-field';
}
function areArraysDifferent(source, target) {
    // Quick length check
    if (source.length !== target.length) {
        return true;
    }
    // Content comparison (order matters)
    for (var i = 0; i < source.length; i++) {
        if (source[i] !== target[i]) {
            return true;
        }
    }
    return false;
}
// this function is exported for testing purposes
var getCoverageResources = function (input) {
    var _a, _b, _c, _d, _e, _f;
    var newCoverages = {};
    var questionnaireResponse = input.questionnaireResponse, organizationResources = input.organizationResources, patientId = input.patientId;
    var flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(questionnaireResponse.item);
    var isSecondaryOnly = checkIsSecondaryOnly(flattenedPaperwork);
    var firstPolicyHolder;
    var firstInsuranceDetails;
    var secondPolicyHolder = (0, exports.getSecondaryPolicyHolderFromAnswers)((_a = questionnaireResponse.item) !== null && _a !== void 0 ? _a : []);
    var secondInsuranceDetails = getInsuranceDetailsFromAnswers(flattenedPaperwork, organizationResources, '-2');
    if (!isSecondaryOnly) {
        firstPolicyHolder = (0, exports.getPrimaryPolicyHolderFromAnswers)((_b = questionnaireResponse.item) !== null && _b !== void 0 ? _b : []);
        firstInsuranceDetails = getInsuranceDetailsFromAnswers(flattenedPaperwork, organizationResources);
    }
    else if (secondPolicyHolder === undefined || secondInsuranceDetails === undefined) {
        secondPolicyHolder = secondPolicyHolder !== null && secondPolicyHolder !== void 0 ? secondPolicyHolder : (0, exports.getPrimaryPolicyHolderFromAnswers)(flattenedPaperwork);
        secondInsuranceDetails =
            secondInsuranceDetails !== null && secondInsuranceDetails !== void 0 ? secondInsuranceDetails : getInsuranceDetailsFromAnswers(flattenedPaperwork, organizationResources);
    }
    var firstInsurance = firstPolicyHolder && firstInsuranceDetails
        ? __assign({ policyHolder: firstPolicyHolder }, firstInsuranceDetails) : undefined;
    var secondInsurance = secondPolicyHolder && secondInsuranceDetails
        ? __assign({ policyHolder: secondPolicyHolder }, secondInsuranceDetails) : undefined;
    var priority1 = (_d = (_c = flattenedPaperwork.find(function (item) { return item.linkId === 'insurance-priority'; })) === null || _c === void 0 ? void 0 : _c.answer) === null || _d === void 0 ? void 0 : _d[0].valueString;
    var priority2 = (_f = (_e = flattenedPaperwork.find(function (item) { return item.linkId === 'insurance-priority-2'; })) === null || _e === void 0 ? void 0 : _e.answer) === null || _f === void 0 ? void 0 : _f[0].valueString;
    var _g = resolveInsurancePriorities(firstInsurance, secondInsurance, priority1, priority2), primaryInsurance = _g.primaryInsurance, secondaryInsurance = _g.secondaryInsurance;
    if (primaryInsurance) {
        var primaryCoverage = createCoverageResource({
            patientId: patientId,
            order: 1,
            insurance: __assign({}, primaryInsurance),
        });
        newCoverages.primary = primaryCoverage;
    }
    if (secondaryInsurance) {
        var secondaryCoverage = createCoverageResource({
            patientId: patientId,
            order: 2,
            insurance: __assign({}, secondaryInsurance),
        });
        newCoverages.secondary = secondaryCoverage;
    }
    var coverage;
    if (newCoverages.primary || newCoverages.secondary) {
        coverage = [];
        if (newCoverages.primary) {
            coverage.push({
                coverage: { reference: newCoverages.primary.id },
                priority: 1,
            });
        }
        if (newCoverages.secondary) {
            coverage.push({
                coverage: { reference: newCoverages.secondary.id },
                priority: 2,
            });
        }
    }
    return { orderedCoverages: newCoverages, accountCoverage: coverage };
};
exports.getCoverageResources = getCoverageResources;
function resolveInsurancePriorities(firstInsurance, secondInsurance, priority1, priority2) {
    var firstIsSecondary = priority1 === 'Secondary';
    var secondIsPrimary = priority2 === 'Primary';
    var primaryInsurance;
    var secondaryInsurance;
    if (firstInsurance && secondInsurance) {
        if (firstIsSecondary && secondIsPrimary) {
            primaryInsurance = secondInsurance;
            secondaryInsurance = firstInsurance;
        }
        else {
            primaryInsurance = firstInsurance;
            secondaryInsurance = secondInsurance;
        }
    }
    else if (firstInsurance) {
        if (firstIsSecondary) {
            secondaryInsurance = firstInsurance;
        }
        else {
            primaryInsurance = firstInsurance;
        }
    }
    else if (secondInsurance) {
        if (secondIsPrimary) {
            primaryInsurance = secondInsurance;
        }
        else {
            secondaryInsurance = secondInsurance;
        }
    }
    return { primaryInsurance: primaryInsurance, secondaryInsurance: secondaryInsurance };
}
function searchInsuranceInformation(oystehr, insuranceOrgRefs) {
    return __awaiter(this, void 0, void 0, function () {
        var orgIds, searchResults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orgIds = insuranceOrgRefs
                        .map(function (ref) {
                        var _a = ref.split('/'), resType = _a[0], id = _a[1];
                        if (resType === 'Organization' && id) {
                            return id;
                        }
                        return '';
                    })
                        .filter(function (id) { return !!id; });
                    if (orgIds.length !== insuranceOrgRefs.length) {
                        console.log('searchInsuranceInformation: some Organization references were invalid:', insuranceOrgRefs);
                    }
                    if (orgIds.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: [
                                {
                                    name: '_id',
                                    value: orgIds.join(','),
                                },
                            ],
                        })];
                case 1:
                    searchResults = _a.sent();
                    return [2 /*return*/, searchResults.unbundle()];
            }
        });
    });
}
var getCoverageGroups = function (items) {
    var VARIABLE_PRIORITY_COVERAGE_SECTION_ID = 'insurance-section';
    var groups = [];
    items.forEach(function (item) {
        var linkId = item.linkId;
        if (linkId.startsWith(VARIABLE_PRIORITY_COVERAGE_SECTION_ID) && item.item) {
            groups.push(item.item);
        }
    });
    return groups;
};
var tagCoverageGroupWithPriority = function (items) {
    var _a, _b;
    var primaryItem = items.find(function (item) { var _a, _b; return item.linkId.startsWith('insurance-priority') && ((_b = (_a = item.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString) === 'Primary'; });
    var secondaryItem = items.find(function (item) { var _a, _b; return item.linkId.startsWith('insurance-priority') && ((_b = (_a = item.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString) === 'Secondary'; });
    var isPrimary = primaryItem !== undefined;
    var isSecondary = secondaryItem !== undefined;
    var primarySuffix = parseInt((_a = primaryItem === null || primaryItem === void 0 ? void 0 : primaryItem.linkId.split('-').pop()) !== null && _a !== void 0 ? _a : '');
    var secondarySuffix = parseInt((_b = secondaryItem === null || secondaryItem === void 0 ? void 0 : secondaryItem.linkId.split('-').pop()) !== null && _b !== void 0 ? _b : '');
    if (isPrimary) {
        return {
            priority: 'Primary',
            items: items,
            suffix: Number.isNaN(primarySuffix) ? '' : "-".concat(primarySuffix),
        };
    }
    if (isSecondary) {
        return {
            priority: 'Secondary',
            items: items,
            suffix: Number.isNaN(secondarySuffix) ? '' : "-".concat(secondarySuffix),
        };
    }
    return undefined;
};
// the following 3 functions are exported for testing purposes; not expected to be called outside this file but for unit testing
var getPrimaryPolicyHolderFromAnswers = function (items) {
    // group the coverage-related items into their respective group(s)
    // if there is some indication in the answers within each group that the group should be treated as primary,
    // use that group here, regardless of the suffix used within that group
    var coverageGroups = getCoverageGroups(items);
    var prioritizedCoverageGroups = coverageGroups
        .map(tagCoverageGroupWithPriority)
        .filter(Boolean);
    var foundPrimaryGroup = prioritizedCoverageGroups.find(function (group) { return group.priority === 'Primary'; });
    if (foundPrimaryGroup) {
        return extractPolicyHolder(foundPrimaryGroup.items, foundPrimaryGroup.suffix);
    }
    var flattenedItems = (0, utils_1.flattenIntakeQuestionnaireItems)(items);
    return extractPolicyHolder(flattenedItems);
};
exports.getPrimaryPolicyHolderFromAnswers = getPrimaryPolicyHolderFromAnswers;
var getSecondaryPolicyHolderFromAnswers = function (items) {
    // group the coverage-related items into their respective group(s)
    // if there is some indication in the answers within each group that the group should be treated as secondary,
    // use that group here, regardless of the suffix used within that group
    var coverageGroups = getCoverageGroups(items);
    var prioritizedCoverageGroups = coverageGroups
        .map(tagCoverageGroupWithPriority)
        .filter(Boolean);
    var foundSecondaryGroup = prioritizedCoverageGroups.find(function (group) { return group.priority === 'Secondary'; });
    if (foundSecondaryGroup) {
        return extractPolicyHolder(foundSecondaryGroup.items, foundSecondaryGroup.suffix);
    }
    var flattenedItems = (0, utils_1.flattenIntakeQuestionnaireItems)(items);
    return extractPolicyHolder(flattenedItems, '-2');
};
exports.getSecondaryPolicyHolderFromAnswers = getSecondaryPolicyHolderFromAnswers;
// EHR design calls for tertiary insurance to be handled in addition to secondary - will need some changes to support this
var checkIsSecondaryOnly = function (items) {
    var priorities = items.filter(function (item) { return item.linkId === 'insurance-priority' || item.linkId === 'insurance-priority-2'; });
    if (priorities.length === 0) {
        return false;
    }
    return !priorities.some(function (item) { var _a, _b; return ((_b = (_a = item.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString) === 'Primary'; });
};
// note: this function assumes items have been flattened before being passed in
var extractPolicyHolder = function (items, keySuffix) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var findAnswer = function (linkId) { var _a, _b, _c; return (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString; };
    var suffix = keySuffix ? "".concat(keySuffix) : '';
    var contact = {
        birthSex: findAnswer("policy-holder-birth-sex".concat(suffix)),
        dob: (_a = findAnswer("policy-holder-date-of-birth".concat(suffix))) !== null && _a !== void 0 ? _a : '',
        firstName: (_b = findAnswer("policy-holder-first-name".concat(suffix))) !== null && _b !== void 0 ? _b : '',
        middleName: (_c = findAnswer("policy-holder-middle-name".concat(suffix))) !== null && _c !== void 0 ? _c : '',
        lastName: (_d = findAnswer("policy-holder-last-name".concat(suffix))) !== null && _d !== void 0 ? _d : '',
        number: findAnswer("policy-holder-number".concat(suffix)),
        email: findAnswer("policy-holder-email".concat(suffix)),
        memberId: (_e = findAnswer("insurance-member-id".concat(suffix))) !== null && _e !== void 0 ? _e : '',
        relationship: findAnswer("patient-relationship-to-insured".concat(suffix)),
    };
    var address = {
        line: [
            (_f = findAnswer("policy-holder-address".concat(suffix))) !== null && _f !== void 0 ? _f : '',
            (_g = findAnswer("policy-holder-address-additional-line".concat(suffix))) !== null && _g !== void 0 ? _g : '',
        ].filter(Boolean),
        city: (_h = findAnswer("policy-holder-city".concat(suffix))) !== null && _h !== void 0 ? _h : '',
        state: (_j = findAnswer("policy-holder-state".concat(suffix))) !== null && _j !== void 0 ? _j : '',
        postalCode: (_k = findAnswer("policy-holder-zip".concat(suffix))) !== null && _k !== void 0 ? _k : '',
    };
    if (address.line.length > 0 || address.city || address.state || address.postalCode) {
        contact.address = address;
    }
    if (contact.firstName &&
        contact.lastName &&
        contact.dob &&
        contact.birthSex &&
        contact.relationship &&
        contact.memberId) {
        return contact;
    }
    return undefined;
};
// note: this function assumes items have been flattened before being passed in
// this function is exported for testing purposes; not expected to be called outside this file but for unit testing
function extractAccountGuarantor(items) {
    var _a, _b, _c, _d;
    var findAnswer = function (linkId) { var _a, _b, _c; return (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString; };
    var city = findAnswer('responsible-party-city');
    var addressLine = findAnswer('responsible-party-address');
    var line = addressLine ? [addressLine] : undefined;
    var addressLine2 = findAnswer('responsible-party-address-2');
    if (addressLine2)
        line === null || line === void 0 ? void 0 : line.push(addressLine2);
    var state = findAnswer('responsible-party-state');
    var postalCode = findAnswer('responsible-party-zip');
    var guarantorAddress = {
        city: city,
        line: line,
        state: state,
        postalCode: postalCode,
    };
    var contact = {
        birthSex: findAnswer('responsible-party-birth-sex'),
        dob: (_a = findAnswer('responsible-party-date-of-birth')) !== null && _a !== void 0 ? _a : '',
        firstName: (_b = findAnswer('responsible-party-first-name')) !== null && _b !== void 0 ? _b : '',
        lastName: (_c = findAnswer('responsible-party-last-name')) !== null && _c !== void 0 ? _c : '',
        relationship: findAnswer('responsible-party-relationship'),
        address: guarantorAddress,
        email: (_d = findAnswer('responsible-party-email')) !== null && _d !== void 0 ? _d : '',
        number: findAnswer('responsible-party-number'),
    };
    if (contact.firstName && contact.lastName && contact.dob && contact.birthSex && contact.relationship) {
        return contact;
    }
    return undefined;
}
function extractEmergencyContact(items) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var findAnswer = function (linkId) { var _a, _b, _c; return (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString; };
    var findBooleanAnswer = function (linkId) { var _a, _b, _c; return (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueBoolean; };
    var contact = {
        middleName: (_a = findAnswer('emergency-contact-middle-name')) !== null && _a !== void 0 ? _a : '',
        firstName: (_b = findAnswer('emergency-contact-first-name')) !== null && _b !== void 0 ? _b : '',
        lastName: (_c = findAnswer('emergency-contact-last-name')) !== null && _c !== void 0 ? _c : '',
        relationship: findAnswer('emergency-contact-relationship'),
        number: (_d = findAnswer('emergency-contact-number')) !== null && _d !== void 0 ? _d : '',
        addressLine: (_e = findAnswer('emergency-contact-address')) !== null && _e !== void 0 ? _e : undefined,
        addressLine2: (_f = findAnswer('emergency-contact-address-2')) !== null && _f !== void 0 ? _f : undefined,
        city: (_g = findAnswer('emergency-contact-city')) !== null && _g !== void 0 ? _g : undefined,
        state: (_h = findAnswer('emergency-contact-state')) !== null && _h !== void 0 ? _h : undefined,
        zip: (_j = findAnswer('emergency-contact-zip')) !== null && _j !== void 0 ? _j : undefined,
        addressSameAsPatient: findBooleanAnswer('emergency-contact-address-as-patient'),
    };
    if (contact.firstName && contact.lastName && contact.number && contact.relationship) {
        return contact;
    }
    return undefined;
}
var buildEmergencyContactAddress = function (contact, patient) {
    var _a, _b;
    if (contact.addressSameAsPatient) {
        var patientAddress = (_a = patient.address) === null || _a === void 0 ? void 0 : _a[0];
        if (patientAddress) {
            return {
                line: patientAddress.line ? __spreadArray([], patientAddress.line, true) : undefined,
                city: patientAddress.city,
                state: patientAddress.state,
                postalCode: patientAddress.postalCode,
            };
        }
    }
    var addressLine = contact.addressLine, addressLine2 = contact.addressLine2, city = contact.city, state = contact.state, zip = contact.zip;
    var hasAddressData = addressLine || addressLine2 || city || state || zip;
    if (!hasAddressData) {
        return undefined;
    }
    var address = {
        line: [addressLine, addressLine2].filter(Boolean),
        city: city,
        state: state,
        postalCode: zip,
    };
    if (!((_b = address.line) === null || _b === void 0 ? void 0 : _b.length)) {
        delete address.line;
    }
    return address;
};
function getInsuranceDetailsFromAnswers(answers, organizations, keySuffix) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var suffix = keySuffix ? "".concat(keySuffix) : '';
    var insuranceOrgReference = (_c = (_b = (_a = answers.find(function (item) { return item.linkId === "insurance-carrier".concat(suffix); })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueReference;
    if (!insuranceOrgReference)
        return undefined;
    var org = organizations.find(function (org) { return "".concat(org.resourceType, "/").concat(org.id) === insuranceOrgReference.reference; });
    if (!org)
        return undefined;
    var qType = (_f = (_e = (_d = answers.find(function (item) { return item.linkId === "insurance-plan-type".concat(suffix); })) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString;
    var typeCode = undefined;
    if (qType && utils_1.INSURANCE_CANDID_PLAN_TYPE_CODES.includes(qType)) {
        typeCode = qType;
    }
    var additionalInformation = (_j = (_h = (_g = answers.find(function (item) { return item.linkId === "insurance-additional-information".concat(suffix); })) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    return { org: org, additionalInformation: additionalInformation, typeCode: typeCode };
}
var createTelecom = function (system, value) {
    if (!value) {
        return undefined;
    }
    return {
        system: system,
        value: value,
    };
};
var safeFormatPhone = function (value) {
    if (!value) {
        return undefined;
    }
    try {
        return (0, utils_1.formatPhoneNumber)(value);
    }
    catch (error) {
        console.warn("Unable to format employer phone number ".concat(value), error);
        return value;
    }
};
var ensurePatientSubject = function (subjects, patientReference) {
    var normalized = subjects ? __spreadArray([], subjects, true) : [];
    if (!normalized.some(function (subject) { return subject.reference === patientReference; })) {
        normalized.push({ reference: patientReference });
    }
    return normalized;
};
var mergeGuarantors = function (guarantors, organizationReference) {
    var filtered = (guarantors !== null && guarantors !== void 0 ? guarantors : []).filter(function (guarantor) { var _a; return ((_a = guarantor.party) === null || _a === void 0 ? void 0 : _a.reference) !== organizationReference; });
    return __spreadArray(__spreadArray([], filtered, true), [
        {
            party: {
                reference: organizationReference,
                type: 'Organization',
            },
        },
    ], false);
};
var buildEmployerOrganization = function (details, id) {
    var lines = [details.addressLine1, details.addressLine2].filter(Boolean);
    var phone = safeFormatPhone(details.contactPhone);
    var fax = safeFormatPhone(details.contactFax);
    var telecom = [
        createTelecom('phone', phone),
        createTelecom('fax', fax),
        createTelecom('email', details.contactEmail),
    ].filter(Boolean);
    var address = lines.length || details.city || details.state || details.zip
        ? [
            {
                line: lines.length ? lines : undefined,
                city: details.city || undefined,
                state: details.state || undefined,
                postalCode: details.zip || undefined,
            },
        ]
        : undefined;
    var contactGiven = details.contactFirstName ? [details.contactFirstName] : [];
    var hasContactName = contactGiven.length || details.contactLastName;
    var contactEntry = hasContactName || telecom.length || details.contactTitle
        ? [
            {
                name: hasContactName
                    ? {
                        given: contactGiven.length ? contactGiven : undefined,
                        family: details.contactLastName || undefined,
                    }
                    : undefined,
                telecom: telecom.length ? telecom : undefined,
                purpose: details.contactTitle ? { text: details.contactTitle } : undefined,
            },
        ]
        : undefined;
    var employerOrgCode = 'workers-comp-employer';
    // fhir dictates that an Organization SHALL at least have a name or an identifier, and possibly more than one
    // adding this id allows users to enter employee data with out an employee name
    var employerOrgIdentifier = { system: utils_1.EMPLOYER_ORG_IDENTIFIER_SYSTEM, value: employerOrgCode };
    return {
        resourceType: 'Organization',
        id: id,
        name: details.employerName || undefined,
        address: address,
        telecom: telecom.length ? telecom : undefined,
        contact: contactEntry,
        identifier: [employerOrgIdentifier],
        type: [
            {
                coding: [
                    {
                        system: utils_1.FHIR_EXTENSION.Organization.organizationType.url,
                        code: employerOrgCode,
                    },
                ],
            },
        ],
    };
};
var buildEmployerAccountResource = function (params) {
    var _a;
    var patientId = params.patientId, existingAccount = params.existingAccount, organizationReference = params.organizationReference, accountTypeCoding = params.accountTypeCoding, employerInformation = params.employerInformation, coverageReference = params.coverageReference;
    var patientReference = "Patient/".concat(patientId);
    var baseAccount = existingAccount ? __assign({}, existingAccount) : { resourceType: 'Account', status: 'active' };
    var subject = ensurePatientSubject(baseAccount.subject, patientReference);
    var guarantor = mergeGuarantors(baseAccount.guarantor, organizationReference);
    var organizationIdFromReference = organizationReference.startsWith('Organization/')
        ? organizationReference.split('/')[1]
        : undefined;
    return __assign(__assign({}, baseAccount), { resourceType: 'Account', status: 'active', type: {
            coding: __spreadArray([], ((accountTypeCoding === null || accountTypeCoding === void 0 ? void 0 : accountTypeCoding.coding) || []), true),
        }, name: employerInformation === null || employerInformation === void 0 ? void 0 : employerInformation.employerName, subject: subject, owner: { reference: organizationReference }, guarantor: guarantor, contained: organizationIdFromReference
            ? (_a = baseAccount.contained) === null || _a === void 0 ? void 0 : _a.filter(function (resource) { return !(resource.resourceType === 'Organization' && resource.id === organizationIdFromReference); })
            : baseAccount.contained, coverage: coverageReference
            ? [
                {
                    coverage: { reference: coverageReference },
                },
            ]
            : undefined });
};
var getOccupationalMedicineEmployerInformation = function (items) {
    var getAnswerReference = function (linkId) { var _a, _b, _c; return (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueReference; };
    var occupationalMedicineEmployerReference = getAnswerReference('occupational-medicine-employer');
    if (!occupationalMedicineEmployerReference) {
        return undefined;
    }
    return {
        occupationalMedicineEmployerReference: occupationalMedicineEmployerReference,
    };
};
var getEmployerInformation = function (items) {
    var _a, _b, _c, _d;
    var getAnswerString = function (linkId) { var _a, _b, _c, _d; return (_d = (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString) === null || _d === void 0 ? void 0 : _d.trim(); };
    var workersCompInsurance = (_d = (_c = (_b = (_a = items.find(function (item) { return item.linkId === 'workers-comp-insurance-name'; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueReference) === null || _d === void 0 ? void 0 : _d.reference;
    var workersCompMemberId = getAnswerString('workers-comp-insurance-member-id');
    var employerName = getAnswerString('employer-name');
    var addressLine1 = getAnswerString('employer-address');
    var city = getAnswerString('employer-city');
    var state = getAnswerString('employer-state');
    var zip = getAnswerString('employer-zip');
    var contactFirstName = getAnswerString('employer-contact-first-name');
    var contactLastName = getAnswerString('employer-contact-last-name');
    var contactPhone = getAnswerString('employer-contact-phone');
    var hasAnyValue = [
        workersCompInsurance,
        workersCompMemberId,
        employerName,
        addressLine1,
        city,
        state,
        zip,
        contactFirstName,
        contactLastName,
        contactPhone,
        getAnswerString('employer-address-2'),
        getAnswerString('employer-contact-email'),
        getAnswerString('employer-contact-fax'),
        getAnswerString('employer-contact-title'),
    ].some(function (value) { return value && value.length; });
    if (!hasAnyValue) {
        return undefined;
    }
    return {
        workersCompInsurance: workersCompInsurance,
        workersCompMemberId: workersCompMemberId,
        employerName: employerName,
        addressLine1: addressLine1,
        addressLine2: getAnswerString('employer-address-2'),
        city: city,
        state: state,
        zip: zip,
        contactFirstName: contactFirstName,
        contactLastName: contactLastName,
        contactPhone: contactPhone,
        contactEmail: getAnswerString('employer-contact-email'),
        contactFax: getAnswerString('employer-contact-fax'),
        contactTitle: getAnswerString('employer-contact-title'),
    };
};
var getAttorneyInformation = function (items) {
    var getAnswerString = function (linkId) { var _a, _b, _c, _d; return (_d = (_c = (_b = (_a = items.find(function (item) { return item.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString) === null || _d === void 0 ? void 0 : _d.trim(); };
    var hasAttorney = getAnswerString('attorney-mva-has-attorney');
    if (hasAttorney === 'I do not have an attorney') {
        return undefined;
    }
    var firm = getAnswerString('attorney-mva-firm');
    var firstName = getAnswerString('attorney-mva-first-name');
    var lastName = getAnswerString('attorney-mva-last-name');
    var email = getAnswerString('attorney-mva-email');
    var mobile = getAnswerString('attorney-mva-mobile');
    var fax = getAnswerString('attorney-mva-fax');
    var hasAnyValue = [firm, firstName, lastName, email, mobile, fax].some(function (value) { return value && value.length; });
    if (!hasAnyValue) {
        return undefined;
    }
    return {
        firm: firm,
        firstName: firstName,
        lastName: lastName,
        email: email,
        mobile: mobile,
        fax: fax,
    };
};
var buildAttorneyRelatedPerson = function (details, patientId, id, existingRelatedPerson) {
    var _a;
    var phone = safeFormatPhone(details.mobile);
    var fax = safeFormatPhone(details.fax);
    var telecom = [
        createTelecom('phone', phone),
        createTelecom('fax', fax),
        createTelecom('email', details.email),
    ].filter(Boolean);
    var givenNames = details.firstName ? [details.firstName] : [];
    var familyName = details.lastName;
    var firmExtensionUrl = "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/attorney-firm");
    var firmExtension = details.firm
        ? {
            url: firmExtensionUrl,
            valueString: details.firm,
        }
        : undefined;
    // Preserve existing extensions, but update or add the firm extension
    var existingExtensions = ((_a = existingRelatedPerson === null || existingRelatedPerson === void 0 ? void 0 : existingRelatedPerson.extension) === null || _a === void 0 ? void 0 : _a.filter(function (ext) { return ext.url !== firmExtensionUrl; })) || [];
    var extensions = firmExtension
        ? __spreadArray(__spreadArray([], existingExtensions, true), [firmExtension], false) : existingExtensions.length
        ? existingExtensions
        : undefined;
    return {
        resourceType: 'RelatedPerson',
        id: id,
        patient: {
            reference: "Patient/".concat(patientId),
        },
        name: givenNames.length || familyName
            ? [
                {
                    given: givenNames.length ? givenNames : undefined,
                    family: familyName,
                },
            ]
            : undefined,
        telecom: telecom.length ? telecom : undefined,
        relationship: [
            {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                        code: 'OTHER',
                        display: 'MVA Attorney',
                    },
                ],
            },
        ],
        extension: extensions,
    };
};
var createCoverageResource = function (input) {
    var _a, _b, _c, _d;
    var patientId = input.patientId, insurance = input.insurance;
    var org = insurance.org, policyHolder = insurance.policyHolder, additionalInformation = insurance.additionalInformation, typeCode = insurance.typeCode;
    var memberId = policyHolder.memberId;
    var payerId = (0, utils_1.getPayerId)(org);
    if (!payerId) {
        throw new Error('payerId unexpectedly missing from insuranceOrg');
    }
    var policyHolderId = 'coverageSubscriber';
    var policyHolderName = (0, utils_1.createFhirHumanName)(policyHolder.firstName, policyHolder.middleName, policyHolder.lastName);
    var relationshipCode = utils_1.SUBSCRIBER_RELATIONSHIP_CODE_MAP[policyHolder.relationship] || 'other';
    var containedPolicyHolder = {
        resourceType: 'RelatedPerson',
        id: policyHolderId,
        name: policyHolderName ? policyHolderName : undefined,
        birthDate: policyHolder.dob,
        gender: (0, utils_1.mapBirthSexToGender)(policyHolder.birthSex),
        patient: { reference: "Patient/".concat(patientId) },
        address: [policyHolder.address],
        relationship: [
            {
                coding: [
                    {
                        system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                        code: relationshipCode,
                        display: policyHolder.relationship,
                    },
                ],
            },
        ],
    };
    var contained;
    var subscriberReference = "#".concat(policyHolderId);
    if (relationshipCode === 'self') {
        subscriberReference = "Patient/".concat(patientId);
    }
    else {
        contained = [containedPolicyHolder];
    }
    var coverage = {
        contained: contained,
        id: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
        identifier: [(0, utils_1.createCoverageMemberIdentifier)(memberId, org)],
        resourceType: 'Coverage',
        status: 'active',
        subscriber: {
            reference: subscriberReference,
        },
        beneficiary: {
            type: 'Patient',
            reference: "Patient/".concat(patientId),
        },
        type: typeCode !== undefined ? { coding: [{ system: utils_1.CANDID_PLAN_TYPE_SYSTEM, code: typeCode }] } : undefined,
        payor: [{ reference: "Organization/".concat(org.id) }],
        subscriberId: policyHolder.memberId,
        relationship: getPolicyHolderRelationshipCodeableConcept(policyHolder.relationship),
        class: [
            {
                type: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                            code: 'plan',
                        },
                    ],
                },
                value: payerId,
                name: "".concat((_a = org.name) !== null && _a !== void 0 ? _a : ''),
            },
        ],
    };
    var coverageTypeCoding = (_b = utils_1.VALUE_SETS.insuranceTypeOptions.find(function (planType) { return planType.candidCode === typeCode; })) === null || _b === void 0 ? void 0 : _b.coverageCoding;
    if (coverageTypeCoding)
        (_d = (_c = coverage.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.push(coverageTypeCoding);
    if (additionalInformation) {
        coverage.extension = [
            {
                url: utils_1.COVERAGE_ADDITIONAL_INFORMATION_URL,
                valueString: additionalInformation,
            },
        ];
    }
    return coverage;
};
function createErxContactOperation(relatedPerson, patientResource) {
    var _a, _b, _c;
    var verifiedPhoneNumber = (0, utils_1.getPhoneNumberForIndividual)(relatedPerson);
    console.log("patient verified phone number ".concat(verifiedPhoneNumber));
    console.log('reviewing patient erx contact telecom phone number');
    // find existing erx contact info and it's index so that the contact array can be updated
    var erxContactIdx = (_a = patientResource === null || patientResource === void 0 ? void 0 : patientResource.contact) === null || _a === void 0 ? void 0 : _a.findIndex(function (contact) {
        var _a;
        return Boolean((_a = contact.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecom) { var _a; return Boolean((_a = telecom === null || telecom === void 0 ? void 0 : telecom.extension) === null || _a === void 0 ? void 0 : _a.find(function (telExt) { return telExt.url === utils_1.FHIR_EXTENSION.ContactPoint.erxTelecom.url; })); }));
    });
    var updateErxContact = false;
    var erxContact = erxContactIdx && erxContactIdx >= 0 ? (_b = patientResource === null || patientResource === void 0 ? void 0 : patientResource.contact) === null || _b === void 0 ? void 0 : _b[erxContactIdx] : undefined;
    var erxTelecom = erxContact &&
        ((_c = erxContact.telecom) === null || _c === void 0 ? void 0 : _c.find(function (telecom) { var _a; return Boolean((_a = telecom === null || telecom === void 0 ? void 0 : telecom.extension) === null || _a === void 0 ? void 0 : _a.find(function (telExt) { return telExt.url === utils_1.FHIR_EXTENSION.ContactPoint.erxTelecom.url; })); }));
    if (erxContactIdx && erxContactIdx >= 0) {
        if (!(erxTelecom && erxTelecom.system === 'phone' && erxTelecom.value === verifiedPhoneNumber)) {
            updateErxContact = true;
        }
    }
    else {
        updateErxContact = true;
    }
    if (updateErxContact) {
        var erxContactTelecom = {
            value: verifiedPhoneNumber,
            system: 'phone',
            extension: [{ url: utils_1.FHIR_EXTENSION.ContactPoint.erxTelecom.url, valueString: 'erx' }],
        };
        if (erxContactIdx && erxContactIdx >= 0) {
            console.log('building patient patch operations: update patient erx contact telecom');
            return {
                op: 'replace',
                path: "/contact/".concat(erxContactIdx),
                value: {
                    telecom: [erxContactTelecom],
                },
            };
        }
        else {
            console.log('building patient patch operations: add patient erx contact telecom');
            if (patientResource.contact === undefined) {
                return {
                    op: 'add',
                    path: "/contact",
                    value: [
                        {
                            telecom: [erxContactTelecom],
                        },
                    ],
                };
            }
            else {
                return {
                    op: 'add',
                    path: "/contact/-",
                    value: {
                        telecom: [erxContactTelecom],
                    },
                };
            }
        }
    }
    return undefined;
}
// this function is exported for testing purposes
var getAccountOperations = function (input) {
    var _a, _b, _c, _d;
    var patient = input.patient, existingCoverages = input.existingCoverages, questionnaireResponseItem = input.questionnaireResponseItem, existingGuarantorResource = input.existingGuarantorResource, organizationResources = input.organizationResources, existingAccount = input.existingAccount, preserveOmittedCoverages = input.preserveOmittedCoverages, existingEmergencyContact = input.existingEmergencyContact, existingWorkersCompAccount = input.existingWorkersCompAccount, existingOccupationalMedicineAccount = input.existingOccupationalMedicineAccount, existingEmployerOrganization = input.existingEmployerOrganization, existingAttorneyRelatedPerson = input.existingAttorneyRelatedPerson;
    if (!patient.id) {
        throw new Error('Patient resource must have an id');
    }
    var flattenedItems = (0, utils_1.flattenItems)(questionnaireResponseItem !== null && questionnaireResponseItem !== void 0 ? questionnaireResponseItem : []);
    var guarantorData = extractAccountGuarantor(flattenedItems);
    var emergencyContactData = extractEmergencyContact(flattenedItems);
    var emergencyContactAddress = emergencyContactData !== undefined ? buildEmergencyContactAddress(emergencyContactData, patient) : undefined;
    var employerInformation = getEmployerInformation(flattenedItems);
    var occupationalMedicineEmployerInformation = getOccupationalMedicineEmployerInformation(flattenedItems);
    var occupationalMedicineEmployerReference;
    if (occupationalMedicineEmployerInformation) {
        occupationalMedicineEmployerReference =
            occupationalMedicineEmployerInformation.occupationalMedicineEmployerReference;
    }
    var attorneyInformation = getAttorneyInformation(flattenedItems);
    /*console.log(
      'insurance plan resources',
      JSON.stringify(insurancePlanResources, null, 2),
      JSON.stringify(organizationResources, null, 2),
      JSON.stringify(flattenedItems, null, 2)
    );*/
    var questionnaireCoverages = (0, exports.getCoverageResources)({
        questionnaireResponse: {
            item: flattenedItems,
        },
        patientId: patient.id,
        organizationResources: organizationResources,
    }).orderedCoverages;
    console.log('insurance plan ordered coverages', JSON.stringify(questionnaireCoverages, null, 2));
    var patch = [];
    var coveragePosts = [];
    var puts = [];
    var accountPost;
    var emergencyContactPost;
    var employerOrganizationPost;
    var employerOrganizationPut;
    var workersCompAccountPost;
    var workersCompAccountPut;
    var occupationalMedicineAccountPost;
    var occupationalMedicineAccountPut;
    var attorneyRelatedPersonPost;
    var attorneyRelatedPersonPut;
    console.log('getting account operations for patient, guarantorData, emergencyContactData, coverages, account, employerInformation, occupationalMedicineEmployerInformation', JSON.stringify(patient, null, 2), JSON.stringify(guarantorData, null, 2), JSON.stringify(emergencyContactData, null, 2), JSON.stringify(existingCoverages, null, 2), JSON.stringify(existingAccount, null, 2), JSON.stringify(employerInformation, null, 2), JSON.stringify(occupationalMedicineEmployerInformation, null, 2));
    // note: We're not assuming existing Coverages, if there are any, come from the Account resource; they could be free-floating.
    // If the existingAccount does reference Coverages, those Coverage resources will be fetched up using the references on
    // the existingAccount and passed in here separately via the existingCoverages parameter.
    var _e = (0, exports.resolveCoverageUpdates)({
        patient: patient,
        existingCoverages: existingCoverages,
        newCoverages: questionnaireCoverages,
        preserveOmittedCoverages: preserveOmittedCoverages,
    }), suggestedNewCoverageObject = _e.suggestedNewCoverageObject, deactivatedCoverages = _e.deactivatedCoverages, coverageUpdates = _e.coverageUpdates, relatedPersonUpdates = _e.relatedPersonUpdates;
    deactivatedCoverages.forEach(function (cov) {
        patch.push({
            method: 'PATCH',
            url: "Coverage/".concat(cov.id),
            operations: [
                {
                    op: 'replace',
                    path: '/status',
                    value: 'cancelled',
                },
            ],
        });
    });
    Object.entries(coverageUpdates).forEach(function (_a) {
        var coverageId = _a[0], operations = _a[1];
        if (operations.length) {
            patch.push({
                method: 'PATCH',
                url: "Coverage/".concat(coverageId),
                operations: operations,
            });
        }
    });
    Object.entries(relatedPersonUpdates).forEach(function (_a) {
        var relatedPersonId = _a[0], operations = _a[1];
        if (operations.length) {
            patch.push({
                method: 'PATCH',
                url: "RelatedPerson/".concat(relatedPersonId),
                operations: operations,
            });
        }
    });
    // create Coverage BatchInputPostRequests for either of the Coverages found on Ordered coverage that are also referenced suggestedNewCoverageObject
    // and add them to the coveragePosts array
    Object.entries(questionnaireCoverages).forEach(function (_a) {
        var _key = _a[0], coverage = _a[1];
        if (coverage && (suggestedNewCoverageObject === null || suggestedNewCoverageObject === void 0 ? void 0 : suggestedNewCoverageObject.some(function (cov) { var _a; return ((_a = cov.coverage) === null || _a === void 0 ? void 0 : _a.reference) === coverage.id; }))) {
            coveragePosts.push({
                method: 'POST',
                fullUrl: coverage.id,
                url: 'Coverage',
                resource: __assign(__assign({}, coverage), { id: undefined }),
            });
        }
    });
    if (existingAccount === undefined) {
        var _f = (0, exports.resolveGuarantor)({
            patientId: patient.id,
            guarantorFromQuestionnaire: guarantorData,
        }), guarantors = _f.guarantors, contained = _f.contained;
        var newAccount = (0, exports.createAccount)({
            patientId: patient.id,
            guarantor: guarantors,
            coverage: suggestedNewCoverageObject,
            contained: contained,
        });
        accountPost = newAccount;
    }
    else {
        var _g = (0, exports.resolveGuarantor)({
            patientId: patient.id,
            guarantorFromQuestionnaire: guarantorData,
            existingGuarantorResource: existingGuarantorResource !== null && existingGuarantorResource !== void 0 ? existingGuarantorResource : patient,
            existingGuarantorReferences: (_a = existingAccount.guarantor) !== null && _a !== void 0 ? _a : [],
            existingContained: (_b = existingAccount.contained) !== null && _b !== void 0 ? _b : [],
        }), guarantors = _g.guarantors, contained = _g.contained;
        var updatedAccount = __assign(__assign({}, existingAccount), { guarantor: guarantors, contained: contained, coverage: suggestedNewCoverageObject });
        puts.push({
            method: 'PUT',
            url: "Account/".concat(existingAccount.id),
            resource: updatedAccount,
        });
    }
    // Emergency Contact
    if (existingEmergencyContact && emergencyContactData) {
        var emergencyContactResourceToPut = __assign({}, existingEmergencyContact);
        var givenNames = [emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.firstName];
        if (emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.middleName) {
            givenNames.push(emergencyContactData.middleName);
        }
        emergencyContactResourceToPut.name = [
            {
                given: givenNames,
                family: emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.lastName,
            },
        ];
        emergencyContactResourceToPut.telecom = [
            {
                value: (0, utils_1.formatPhoneNumber)(emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.number),
                system: 'phone',
            },
        ];
        emergencyContactResourceToPut.relationship = [
            {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                        code: 'EP',
                        display: emergencyContactData.relationship,
                    },
                ],
            },
        ];
        if (emergencyContactAddress) {
            emergencyContactResourceToPut.address = [emergencyContactAddress];
        }
        else {
            delete emergencyContactResourceToPut.address;
        }
        puts.push({
            method: 'PUT',
            url: "RelatedPerson/".concat(existingEmergencyContact.id),
            resource: emergencyContactResourceToPut,
        });
    }
    else if (emergencyContactData) {
        var emergencyContactResourceToCreate = {
            resourceType: 'RelatedPerson',
            patient: {
                reference: "Patient/".concat(patient.id),
            },
            relationship: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                            code: 'EP',
                            display: emergencyContactData.relationship,
                        },
                    ],
                },
            ],
        };
        var givenNames = [emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.firstName];
        if (emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.middleName) {
            givenNames.push(emergencyContactData.middleName);
        }
        emergencyContactResourceToCreate.name = [
            {
                given: givenNames,
                family: emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.lastName,
            },
        ];
        emergencyContactResourceToCreate.telecom = [
            {
                value: (0, utils_1.formatPhoneNumber)(emergencyContactData === null || emergencyContactData === void 0 ? void 0 : emergencyContactData.number),
                system: 'phone',
            },
        ];
        if (emergencyContactAddress) {
            emergencyContactResourceToCreate.address = [emergencyContactAddress];
        }
        emergencyContactPost = {
            method: 'POST',
            url: 'RelatedPerson',
            resource: emergencyContactResourceToCreate,
        };
    }
    if (employerInformation) {
        var employerOrganizationReference = void 0;
        if (existingEmployerOrganization === null || existingEmployerOrganization === void 0 ? void 0 : existingEmployerOrganization.id) {
            employerOrganizationReference = "Organization/".concat(existingEmployerOrganization.id);
            employerOrganizationPut = {
                method: 'PUT',
                url: "Organization/".concat(existingEmployerOrganization.id),
                resource: buildEmployerOrganization(employerInformation, existingEmployerOrganization.id),
            };
        }
        else {
            employerOrganizationReference = "urn:uuid:".concat((0, crypto_1.randomUUID)());
            employerOrganizationPost = {
                method: 'POST',
                url: 'Organization',
                fullUrl: employerOrganizationReference,
                resource: buildEmployerOrganization(employerInformation),
            };
        }
        var workersCompCoverage = undefined;
        var workersCompCoverageReference = undefined;
        var workersCompInsurance_1 = employerInformation.workersCompInsurance;
        var workersCompMemberId = employerInformation.workersCompMemberId;
        var workersCompInsuranceOrg = organizationResources.find(function (org) { return "".concat(org.resourceType, "/").concat(org.id) === workersCompInsurance_1; });
        var payerId = (0, utils_1.getPayerId)(workersCompInsuranceOrg);
        if (existingCoverages.workersComp) {
            workersCompCoverage = existingCoverages.workersComp;
            var updatedWorkersCompCoverage = __assign({}, workersCompCoverage);
            workersCompCoverageReference = "Coverage/".concat(workersCompCoverage.id);
            if (workersCompMemberId && workersCompInsuranceOrg) {
                updatedWorkersCompCoverage.identifier = [
                    (0, utils_1.createCoverageMemberIdentifier)(workersCompMemberId, workersCompInsuranceOrg),
                ];
                updatedWorkersCompCoverage.subscriberId = workersCompMemberId;
            }
            if (workersCompInsuranceOrg) {
                updatedWorkersCompCoverage.payor = [{ reference: "Organization/".concat(workersCompInsuranceOrg.id) }];
                updatedWorkersCompCoverage.class = [
                    {
                        type: {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                    code: 'plan',
                                },
                            ],
                        },
                        value: payerId !== null && payerId !== void 0 ? payerId : '',
                        name: "".concat((_c = workersCompInsuranceOrg === null || workersCompInsuranceOrg === void 0 ? void 0 : workersCompInsuranceOrg.name) !== null && _c !== void 0 ? _c : ''),
                    },
                ];
            }
            if (workersCompCoverage !== updatedWorkersCompCoverage) {
                puts.push({
                    method: 'PUT',
                    url: "Coverage/".concat(workersCompCoverage.id),
                    resource: updatedWorkersCompCoverage,
                });
            }
        }
        else if (workersCompInsuranceOrg && payerId) {
            workersCompCoverageReference = "urn:uuid:".concat((0, crypto_1.randomUUID)());
            workersCompCoverage = {
                id: workersCompCoverageReference,
                identifier: workersCompMemberId
                    ? [(0, utils_1.createCoverageMemberIdentifier)(workersCompMemberId, workersCompInsuranceOrg)]
                    : undefined,
                resourceType: 'Coverage',
                status: 'active',
                beneficiary: {
                    type: 'Patient',
                    reference: "Patient/".concat(patient.id),
                },
                type: { coding: [{ system: utils_1.CANDID_PLAN_TYPE_SYSTEM, code: 'WC' }] },
                payor: [{ reference: "Organization/".concat(workersCompInsuranceOrg === null || workersCompInsuranceOrg === void 0 ? void 0 : workersCompInsuranceOrg.id) }],
                relationship: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                            code: 'other',
                            display: 'Other',
                        },
                    ],
                },
                subscriberId: workersCompMemberId,
                class: [
                    {
                        type: {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                                    code: 'plan',
                                },
                            ],
                        },
                        value: payerId,
                        name: "".concat((_d = workersCompInsuranceOrg === null || workersCompInsuranceOrg === void 0 ? void 0 : workersCompInsuranceOrg.name) !== null && _d !== void 0 ? _d : ''),
                    },
                ],
            };
            coveragePosts.push({
                method: 'POST',
                fullUrl: workersCompCoverage.id,
                url: 'Coverage',
                resource: __assign({}, workersCompCoverage),
            });
        }
        var workersCompAccountResource = buildEmployerAccountResource({
            patientId: patient.id,
            existingAccount: existingWorkersCompAccount,
            organizationReference: employerOrganizationReference,
            accountTypeCoding: utils_1.WORKERS_COMP_ACCOUNT_TYPE,
            coverageReference: workersCompCoverageReference,
            employerInformation: employerInformation,
        });
        if (existingWorkersCompAccount === null || existingWorkersCompAccount === void 0 ? void 0 : existingWorkersCompAccount.id) {
            workersCompAccountPut = {
                method: 'PUT',
                url: "Account/".concat(existingWorkersCompAccount.id),
                resource: __assign(__assign({}, workersCompAccountResource), { id: existingWorkersCompAccount.id }),
            };
        }
        else {
            workersCompAccountPost = workersCompAccountResource;
        }
    }
    if (occupationalMedicineEmployerReference === null || occupationalMedicineEmployerReference === void 0 ? void 0 : occupationalMedicineEmployerReference.reference) {
        var occupationalMedicineAccountResource = buildEmployerAccountResource({
            patientId: patient.id,
            existingAccount: existingOccupationalMedicineAccount,
            organizationReference: occupationalMedicineEmployerReference.reference,
            accountTypeCoding: utils_1.OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
            employerInformation: employerInformation,
        });
        if (existingOccupationalMedicineAccount === null || existingOccupationalMedicineAccount === void 0 ? void 0 : existingOccupationalMedicineAccount.id) {
            occupationalMedicineAccountPut = {
                method: 'PUT',
                url: "Account/".concat(existingOccupationalMedicineAccount.id),
                resource: __assign(__assign({}, occupationalMedicineAccountResource), { id: existingOccupationalMedicineAccount.id }),
            };
        }
        else {
            occupationalMedicineAccountPost = occupationalMedicineAccountResource;
        }
    }
    if (attorneyInformation) {
        if (existingAttorneyRelatedPerson === null || existingAttorneyRelatedPerson === void 0 ? void 0 : existingAttorneyRelatedPerson.id) {
            attorneyRelatedPersonPut = {
                method: 'PUT',
                url: "RelatedPerson/".concat(existingAttorneyRelatedPerson.id),
                resource: buildAttorneyRelatedPerson(attorneyInformation, patient.id, existingAttorneyRelatedPerson.id, existingAttorneyRelatedPerson),
            };
        }
        else {
            attorneyRelatedPersonPost = {
                method: 'POST',
                url: 'RelatedPerson',
                resource: buildAttorneyRelatedPerson(attorneyInformation, patient.id),
            };
        }
    }
    return {
        coveragePosts: coveragePosts,
        accountPost: accountPost,
        patch: patch,
        put: puts,
        emergencyContactPost: emergencyContactPost,
        employerOrganizationPost: employerOrganizationPost,
        employerOrganizationPut: employerOrganizationPut,
        workersCompAccountPost: workersCompAccountPost,
        workersCompAccountPut: workersCompAccountPut,
        occupationalMedicineAccountPost: occupationalMedicineAccountPost,
        occupationalMedicineAccountPut: occupationalMedicineAccountPut,
        attorneyRelatedPersonPost: attorneyRelatedPersonPost,
        attorneyRelatedPersonPut: attorneyRelatedPersonPut,
    };
};
exports.getAccountOperations = getAccountOperations;
// this function is exported for testing purposes
var createAccount = function (input) {
    var patientId = input.patientId, guarantor = input.guarantor, coverage = input.coverage, contained = input.contained;
    var account = {
        contained: contained,
        resourceType: 'Account',
        type: __assign({}, utils_1.PATIENT_BILLING_ACCOUNT_TYPE),
        status: 'active',
        subject: [{ reference: "Patient/".concat(patientId) }],
        coverage: coverage,
        guarantor: guarantor,
        description: 'Patient account',
    };
    return account;
};
exports.createAccount = createAccount;
// this function is exported for testing purposes
var resolveCoverageUpdates = function (input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    var patient = input.patient, existingCoverages = input.existingCoverages, newCoverages = input.newCoverages, preserveOmittedCoverages = input.preserveOmittedCoverages;
    var suggestedNewCoverageObject = [];
    var deactivatedCoverages = [];
    var coverageUpdates = {};
    var relatedPersonUpdates = {};
    var existingPrimaryCoverage = existingCoverages.primary;
    var existingSecondaryCoverage = existingCoverages.secondary;
    var existingPrimarySubscriber = existingCoverages.primarySubscriber;
    var existingSecondarySubscriber = existingCoverages.secondarySubscriber;
    // here we're assuming a resource is persisted if it has an id that is a valid uuid
    var existingPrimarySubscriberIsPersisted = (0, utils_1.isValidUUID)((_a = existingPrimarySubscriber === null || existingPrimarySubscriber === void 0 ? void 0 : existingPrimarySubscriber.id) !== null && _a !== void 0 ? _a : '');
    var existingSecondarySubscriberIsPersisted = (0, utils_1.isValidUUID)((_b = existingSecondarySubscriber === null || existingSecondarySubscriber === void 0 ? void 0 : existingSecondarySubscriber.id) !== null && _b !== void 0 ? _b : '');
    var addCoverageUpdates = function (key, updates) {
        var _a;
        var existing = (_a = coverageUpdates[key]) !== null && _a !== void 0 ? _a : [];
        coverageUpdates[key] = __spreadArray(__spreadArray([], existing, true), updates, true);
    };
    var addRelatedPersonUpdates = function (key, updates) {
        var _a;
        var existing = (_a = relatedPersonUpdates[key]) !== null && _a !== void 0 ? _a : [];
        relatedPersonUpdates[key] = __spreadArray(__spreadArray([], existing, true), updates, true);
    };
    var primaryCoverageFromPaperwork = newCoverages.primary;
    var secondaryCoverageFromPaperwork = newCoverages.secondary;
    var primarySubscriberFromPaperwork = undefined;
    var secondarySubscriberFromPaperwork = undefined;
    if (primaryCoverageFromPaperwork) {
        if ((_d = (_c = primaryCoverageFromPaperwork.subscriber) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.startsWith('#')) {
            primarySubscriberFromPaperwork = (_e = primaryCoverageFromPaperwork.contained) === null || _e === void 0 ? void 0 : _e[0];
        }
        else {
            var _y = (_h = (_g = (_f = primaryCoverageFromPaperwork.subscriber) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.split('/')) !== null && _h !== void 0 ? _h : [], resourceType = _y[0], resourceId = _y[1];
            if ("".concat(resourceType, "/").concat(resourceId) === "Patient/".concat(patient.id)) {
                primarySubscriberFromPaperwork = patient;
            }
        }
    }
    if (secondaryCoverageFromPaperwork) {
        if ((_k = (_j = secondaryCoverageFromPaperwork.subscriber) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.startsWith('#')) {
            secondarySubscriberFromPaperwork = (_l = secondaryCoverageFromPaperwork.contained) === null || _l === void 0 ? void 0 : _l[0];
        }
        else {
            var _z = (_p = (_o = (_m = secondaryCoverageFromPaperwork.subscriber) === null || _m === void 0 ? void 0 : _m.reference) === null || _o === void 0 ? void 0 : _o.split('/')) !== null && _p !== void 0 ? _p : [], resourceType = _z[0], resourceId = _z[1];
            if ("".concat(resourceType, "/").concat(resourceId) === "Patient/".concat(patient.id)) {
                secondarySubscriberFromPaperwork = patient;
            }
        }
    }
    if (primaryCoverageFromPaperwork && (0, exports.coveragesAreSame)(primaryCoverageFromPaperwork, secondaryCoverageFromPaperwork)) {
        secondaryCoverageFromPaperwork = undefined;
    }
    if (primaryCoverageFromPaperwork && primarySubscriberFromPaperwork) {
        if ((0, exports.coveragesAreSame)(primaryCoverageFromPaperwork, existingPrimaryCoverage) &&
            (0, exports.relatedPersonsAreSame)(primarySubscriberFromPaperwork, existingPrimarySubscriber)) {
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) },
                priority: 1,
            });
            if ((existingPrimarySubscriber === null || existingPrimarySubscriber === void 0 ? void 0 : existingPrimarySubscriber.id) &&
                existingPrimarySubscriberIsPersisted &&
                existingPrimarySubscriber.resourceType === 'RelatedPerson') {
                var ops = patchOpsForRelatedPerson({
                    source: primarySubscriberFromPaperwork,
                    target: existingPrimarySubscriber,
                });
                addRelatedPersonUpdates(existingPrimarySubscriber.id, ops);
            }
            else if (existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) {
                var ops = patchOpsForCoverage({
                    source: primaryCoverageFromPaperwork,
                    target: existingPrimaryCoverage,
                });
                addCoverageUpdates(existingPrimaryCoverage.id, ops);
            }
        }
        else if ((0, exports.coveragesAreSame)(primaryCoverageFromPaperwork, existingSecondaryCoverage) &&
            (0, exports.relatedPersonsAreSame)(primarySubscriberFromPaperwork, existingSecondarySubscriber)) {
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) },
                priority: 1,
            });
            if ((existingSecondarySubscriber === null || existingSecondarySubscriber === void 0 ? void 0 : existingSecondarySubscriber.id) &&
                existingSecondarySubscriberIsPersisted &&
                existingSecondarySubscriber.resourceType === 'RelatedPerson') {
                var ops = patchOpsForRelatedPerson({
                    source: primarySubscriberFromPaperwork,
                    target: existingSecondarySubscriber,
                });
                addRelatedPersonUpdates(existingSecondarySubscriber.id, ops);
            }
            else if (existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) {
                var ops = patchOpsForCoverage({
                    source: primaryCoverageFromPaperwork,
                    target: existingSecondaryCoverage,
                });
                addCoverageUpdates(existingSecondaryCoverage.id, ops);
            }
        }
        else if ((0, exports.coveragesAreSame)(primaryCoverageFromPaperwork, existingPrimaryCoverage) && (existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id)) {
            var ops = patchOpsForCoverage({
                source: primaryCoverageFromPaperwork,
                target: existingPrimaryCoverage,
            });
            addCoverageUpdates(existingPrimaryCoverage.id, ops);
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) },
                priority: 1,
            });
        }
        else if ((0, exports.coveragesAreSame)(primaryCoverageFromPaperwork, existingSecondaryCoverage) &&
            (existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id)) {
            var ops = patchOpsForCoverage({
                source: primaryCoverageFromPaperwork,
                target: existingSecondaryCoverage,
            });
            addCoverageUpdates(existingSecondaryCoverage.id, ops);
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) },
                priority: 1,
            });
        }
        else {
            suggestedNewCoverageObject.push({
                coverage: { reference: primaryCoverageFromPaperwork.id },
                priority: 1,
            });
        }
    }
    if (secondaryCoverageFromPaperwork && secondarySubscriberFromPaperwork) {
        if ((0, exports.coveragesAreSame)(secondaryCoverageFromPaperwork, existingSecondaryCoverage) &&
            (0, exports.relatedPersonsAreSame)(secondarySubscriberFromPaperwork, existingSecondarySubscriber)) {
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) },
                priority: 2,
            });
            if ((existingSecondarySubscriber === null || existingSecondarySubscriber === void 0 ? void 0 : existingSecondarySubscriber.id) &&
                existingSecondarySubscriberIsPersisted &&
                existingSecondarySubscriber.resourceType === 'RelatedPerson') {
                var ops = patchOpsForRelatedPerson({
                    source: secondarySubscriberFromPaperwork,
                    target: existingSecondarySubscriber,
                });
                addRelatedPersonUpdates(existingSecondarySubscriber.id, ops);
            }
            else if (existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) {
                var ops = patchOpsForCoverage({
                    source: secondaryCoverageFromPaperwork,
                    target: existingSecondaryCoverage,
                });
                addCoverageUpdates(existingSecondaryCoverage.id, ops);
            }
        }
        else if ((0, exports.coveragesAreSame)(secondaryCoverageFromPaperwork, existingPrimaryCoverage) &&
            (0, exports.relatedPersonsAreSame)(secondarySubscriberFromPaperwork, existingPrimarySubscriber)) {
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) },
                priority: 2,
            });
            if ((existingPrimarySubscriber === null || existingPrimarySubscriber === void 0 ? void 0 : existingPrimarySubscriber.id) &&
                existingPrimarySubscriberIsPersisted &&
                existingPrimarySubscriber.resourceType === 'RelatedPerson') {
                var ops = patchOpsForRelatedPerson({
                    source: secondarySubscriberFromPaperwork,
                    target: existingPrimarySubscriber,
                });
                addRelatedPersonUpdates(existingPrimarySubscriber.id, ops);
            }
            else if (existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) {
                var ops = patchOpsForCoverage({
                    source: secondaryCoverageFromPaperwork,
                    target: existingPrimaryCoverage,
                });
                addCoverageUpdates(existingPrimaryCoverage.id, ops);
            }
        }
        else if ((0, exports.coveragesAreSame)(secondaryCoverageFromPaperwork, existingSecondaryCoverage) &&
            (existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id)) {
            var ops = patchOpsForCoverage({
                source: secondaryCoverageFromPaperwork,
                target: existingSecondaryCoverage,
            });
            addCoverageUpdates(existingSecondaryCoverage.id, ops);
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingSecondaryCoverage === null || existingSecondaryCoverage === void 0 ? void 0 : existingSecondaryCoverage.id) },
                priority: 2,
            });
        }
        else if ((0, exports.coveragesAreSame)(secondaryCoverageFromPaperwork, existingPrimaryCoverage) &&
            (existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id)) {
            var ops = patchOpsForCoverage({
                source: secondaryCoverageFromPaperwork,
                target: existingPrimaryCoverage,
            });
            addCoverageUpdates(existingPrimaryCoverage.id, ops);
            suggestedNewCoverageObject.push({
                coverage: { reference: "Coverage/".concat(existingPrimaryCoverage === null || existingPrimaryCoverage === void 0 ? void 0 : existingPrimaryCoverage.id) },
                priority: 2,
            });
        }
        else {
            suggestedNewCoverageObject.push({
                coverage: { reference: secondaryCoverageFromPaperwork.id },
                priority: 2,
            });
        }
    }
    var newPrimaryCoverage = (_q = suggestedNewCoverageObject.find(function (c) { return c.priority === 1; })) === null || _q === void 0 ? void 0 : _q.coverage;
    var newSecondaryCoverage = (_r = suggestedNewCoverageObject.find(function (c) { return c.priority === 2; })) === null || _r === void 0 ? void 0 : _r.coverage;
    if (existingCoverages.primary &&
        existingCoverages.primary.id !== ((_s = newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference) === null || _s === void 0 ? void 0 : _s.split('/')[1]) &&
        existingCoverages.primary.id !== ((_t = newSecondaryCoverage === null || newSecondaryCoverage === void 0 ? void 0 : newSecondaryCoverage.reference) === null || _t === void 0 ? void 0 : _t.split('/')[1])) {
        if (!preserveOmittedCoverages || ((_u = newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference) === null || _u === void 0 ? void 0 : _u.split('/')[1]) !== undefined) {
            deactivatedCoverages.push(existingCoverages.primary);
        }
    }
    if (existingCoverages.secondary &&
        existingCoverages.secondary.id !== ((_v = newSecondaryCoverage === null || newSecondaryCoverage === void 0 ? void 0 : newSecondaryCoverage.reference) === null || _v === void 0 ? void 0 : _v.split('/')[1]) &&
        existingCoverages.secondary.id !== ((_w = newPrimaryCoverage === null || newPrimaryCoverage === void 0 ? void 0 : newPrimaryCoverage.reference) === null || _w === void 0 ? void 0 : _w.split('/')[1])) {
        if (!preserveOmittedCoverages || ((_x = newSecondaryCoverage === null || newSecondaryCoverage === void 0 ? void 0 : newSecondaryCoverage.reference) === null || _x === void 0 ? void 0 : _x.split('/')[1]) !== undefined) {
            deactivatedCoverages.push(existingCoverages.secondary);
        }
    }
    if (preserveOmittedCoverages && existingCoverages.primary && !newPrimaryCoverage) {
        suggestedNewCoverageObject.push({
            coverage: { reference: "Coverage/".concat(existingCoverages.primary.id) },
            priority: 1,
        });
    }
    if (preserveOmittedCoverages && existingCoverages.secondary && !newSecondaryCoverage) {
        suggestedNewCoverageObject.push({
            coverage: { reference: "Coverage/".concat(existingCoverages.secondary.id) },
            priority: 2,
        });
    }
    suggestedNewCoverageObject.sort(function (a, b) { var _a, _b; return ((_a = a === null || a === void 0 ? void 0 : a.priority) !== null && _a !== void 0 ? _a : Number.MAX_VALUE) - ((_b = b === null || b === void 0 ? void 0 : b.priority) !== null && _b !== void 0 ? _b : Number.MAX_VALUE); });
    /*
    console.log('existing primary coverage', JSON.stringify(existingCoverages.primary, null, 2));
    console.log('new primary coverage', JSON.stringify(newPrimaryCoverage, null, 2));
    console.log('existing secondary coverage', JSON.stringify(existingCoverages.secondary, null, 2));
    console.log('new secondary coverage', JSON.stringify(newSecondaryCoverage, null, 2));
    console.log('deactivated coverages', JSON.stringify(deactivatedCoverages, null, 2));
    console.log('coverage updates', JSON.stringify(coverageUpdates, null, 2));
    */
    return {
        suggestedNewCoverageObject: suggestedNewCoverageObject,
        deactivatedCoverages: deactivatedCoverages,
        coverageUpdates: coverageUpdates,
        relatedPersonUpdates: relatedPersonUpdates,
    };
};
exports.resolveCoverageUpdates = resolveCoverageUpdates;
// exporting for testing purposes
var resolveGuarantor = function (input) {
    var patientId = input.patientId, guarantorFromQuestionnaire = input.guarantorFromQuestionnaire, existingGuarantorResource = input.existingGuarantorResource, _a = input.existingGuarantorReferences, existingGuarantorReferences = _a === void 0 ? [] : _a, existingContained = input.existingContained, timestamp = input.timestamp;
    console.log('guarantorFromQuestionnaire', JSON.stringify(guarantorFromQuestionnaire, null, 2));
    if (guarantorFromQuestionnaire === undefined) {
        return { guarantors: existingGuarantorReferences, contained: existingContained };
    }
    else if (guarantorFromQuestionnaire.relationship === 'Self') {
        var currentGuarantorIsPatient = existingGuarantorReferences.some(function (g) {
            var _a;
            return g.party.reference === "Patient/".concat(patientId) && ((_a = g.period) === null || _a === void 0 ? void 0 : _a.end) === undefined;
        });
        if (currentGuarantorIsPatient) {
            return { guarantors: existingGuarantorReferences, contained: existingContained };
        }
        console.log('guarantorFromQuestionnaire is undefined or relationship is self 1');
        var newGuarantor = {
            party: {
                reference: "Patient/".concat(patientId),
                type: 'Patient',
            },
        };
        return {
            guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
            contained: existingContained,
        };
    }
    // the new guarantor is not the patient...
    var existingResourceIsPersisted = existingGuarantorReferences.some(function (r) {
        var _a;
        var ref = r.party.reference;
        if (((_a = r.period) === null || _a === void 0 ? void 0 : _a.end) !== undefined)
            return false;
        return "".concat(existingGuarantorResource === null || existingGuarantorResource === void 0 ? void 0 : existingGuarantorResource.resourceType, "/").concat(existingGuarantorResource === null || existingGuarantorResource === void 0 ? void 0 : existingGuarantorResource.id) === ref;
    });
    var existingResourceType = existingGuarantorResource === null || existingGuarantorResource === void 0 ? void 0 : existingGuarantorResource.resourceType;
    var rpFromGuarantorData = (0, exports.createContainedGuarantor)(guarantorFromQuestionnaire, patientId);
    if (existingResourceType === 'RelatedPerson') {
        if (existingResourceIsPersisted && (0, exports.relatedPersonsAreSame)(existingGuarantorResource, rpFromGuarantorData)) {
            // we won't bother with trying to update the existing RelatedPerson resource
            return {
                guarantors: existingGuarantorReferences,
                contained: existingContained,
            };
        }
        else if ((0, exports.relatedPersonsAreSame)(existingGuarantorResource, rpFromGuarantorData)) {
            var contained = existingContained === null || existingContained === void 0 ? void 0 : existingContained.map(function (c) {
                if (c.id === existingGuarantorResource.id) {
                    // just take the latest full content and leave the id as is
                    return __assign(__assign({}, rpFromGuarantorData), { id: c.id });
                }
                return c;
            });
            return {
                guarantors: existingGuarantorReferences,
                contained: contained,
            };
        }
        else {
            var newGuarantor = {
                party: {
                    reference: "#".concat(rpFromGuarantorData.id),
                    type: 'RelatedPerson',
                },
            };
            return {
                guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
                contained: __spreadArray([rpFromGuarantorData], (existingContained !== null && existingContained !== void 0 ? existingContained : []), true),
            };
        }
    }
    else {
        if (existingContained === null || existingContained === void 0 ? void 0 : existingContained.length) {
            rpFromGuarantorData.id += "-".concat(existingContained.length);
        }
        var newGuarantor = {
            party: {
                reference: "#".concat(rpFromGuarantorData.id),
                type: 'RelatedPerson',
            },
        };
        return {
            guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
            contained: __spreadArray([rpFromGuarantorData], (existingContained !== null && existingContained !== void 0 ? existingContained : []), true),
        };
    }
};
exports.resolveGuarantor = resolveGuarantor;
var coveragesAreSame = function (coverage1, coverage2) {
    var _a, _b;
    if (!coverage2)
        return false;
    var coverage1MemberId = (0, utils_1.getMemberIdFromCoverage)(coverage1);
    var coverage2MemberId = (0, utils_1.getMemberIdFromCoverage)(coverage2);
    if (coverage1MemberId === undefined) {
        var subscriberId = coverage1.subscriberId;
        if (!subscriberId)
            return false;
        coverage1MemberId = subscriberId;
    }
    if (coverage2MemberId === undefined) {
        var subscriberId = coverage2.subscriberId;
        if (!subscriberId)
            return false;
        coverage2MemberId = subscriberId;
    }
    if (coverage1MemberId !== coverage2MemberId)
        return false;
    var coverage1Payor = (_a = coverage1.payor) === null || _a === void 0 ? void 0 : _a[0].reference;
    var coverage2Payor = (_b = coverage2.payor) === null || _b === void 0 ? void 0 : _b[0].reference;
    return coverage1Payor !== undefined && coverage2Payor !== undefined && coverage1Payor === coverage2Payor;
};
exports.coveragesAreSame = coveragesAreSame;
var relatedPersonsAreSame = function (relatedPersons1, relatedPerson2) {
    if (!relatedPerson2)
        return false;
    if (relatedPersons1.resourceType !== relatedPerson2.resourceType)
        return false;
    var fullName1 = (0, utils_1.getFullName)(relatedPersons1);
    var fullName2 = (0, utils_1.getFullName)(relatedPerson2);
    var dob1 = relatedPersons1.birthDate;
    var dob2 = relatedPerson2.birthDate;
    if (!fullName1 || !fullName2 || !dob1 || !dob2)
        return false;
    return fullName1 === fullName2 && dob1 === dob2;
};
exports.relatedPersonsAreSame = relatedPersonsAreSame;
var patchOpsForRelatedPerson = function (input) {
    var keysToUpdate = ['address', 'gender', 'relationship', 'telecom'];
    var ops = [];
    for (var _i = 0, _a = Object.keys(input.source); _i < _a.length; _i++) {
        var key = _a[_i];
        if (keysToUpdate.includes(key)) {
            var sourceValue = input.source[key];
            var targetValue = input.target[key];
            if (key === 'contained' && sourceValue === undefined && targetValue !== undefined) {
                ops.push({
                    op: 'remove',
                    path: "/".concat(key),
                });
            }
            if (sourceValue && !lodash_1.default.isEqual(sourceValue, targetValue) && targetValue === undefined) {
                ops.push({
                    op: 'add',
                    path: "/".concat(key),
                    value: sourceValue,
                });
            }
            else if (sourceValue && !lodash_1.default.isEqual(sourceValue, targetValue)) {
                if (key === 'telecom') {
                    ops.push({
                        op: 'replace',
                        path: "/".concat(key),
                        value: (0, utils_1.deduplicateContactPoints)(__spreadArray(__spreadArray([], sourceValue, true), targetValue, true)),
                    });
                }
                else if (key === 'address') {
                    ops.push({
                        op: 'replace',
                        path: "/".concat(key),
                        value: (0, utils_1.deduplicateObjectsByStrictKeyValEquality)(__spreadArray(__spreadArray([], sourceValue, true), targetValue, true)),
                    });
                }
                else {
                    ops.push({
                        op: 'replace',
                        path: "/".concat(key),
                        value: sourceValue,
                    });
                }
            }
        }
    }
    return ops;
};
var patchOpsForCoverage = function (input) {
    var source = input.source, target = input.target;
    var ops = [];
    var keysToExclude = ['id', 'resourceType'];
    var keysToCheck = Object.keys(source).filter(function (k) { return !keysToExclude.includes(k); });
    for (var _i = 0, keysToCheck_1 = keysToCheck; _i < keysToCheck_1.length; _i++) {
        var key = keysToCheck_1[_i];
        var sourceValue = source[key];
        var targetValue = target[key];
        if (key === 'contained' && sourceValue === undefined && targetValue !== undefined) {
            ops.push({
                op: 'remove',
                path: "/".concat(key),
            });
        }
        if (key === 'type' && sourceValue === undefined && targetValue !== undefined) {
            ops.push({
                op: 'remove',
                path: "/".concat(key),
            });
        }
        if (sourceValue && !lodash_1.default.isEqual(sourceValue, targetValue) && targetValue === undefined) {
            ops.push({
                op: 'add',
                path: "/".concat(key),
                value: sourceValue,
            });
        }
        else if (sourceValue && !lodash_1.default.isEqual(sourceValue, targetValue)) {
            if (key === 'identifier') {
                var newIdentifiers = (0, utils_1.deduplicateIdentifiers)(__spreadArray(__spreadArray([], sourceValue, true), targetValue, true));
                ops.push({
                    op: 'replace',
                    path: "/".concat(key),
                    value: newIdentifiers,
                });
            }
            ops.push({
                op: 'replace',
                path: "/".concat(key),
                value: sourceValue,
            });
        }
    }
    var targetKeys = Object.keys(target).filter(function (k) { return !keysToExclude.includes(k); });
    console.log('targetKeys', targetKeys);
    if (target.extension && Array.isArray(target.extension)) {
        var additionalInfoExtensionUrls_1 = [utils_1.COVERAGE_ADDITIONAL_INFORMATION_URL];
        var sourceExtensions = source.extension || [];
        var sourceExtensionUrls_1 = sourceExtensions.map(function (ext) { return ext.url; });
        target.extension.forEach(function (ext, index) {
            if (additionalInfoExtensionUrls_1.includes(ext.url) && !sourceExtensionUrls_1.includes(ext.url)) {
                ops.push({
                    op: 'remove',
                    path: "/extension/".concat(index),
                });
            }
        });
    }
    else {
        for (var _a = 0, targetKeys_1 = targetKeys; _a < targetKeys_1.length; _a++) {
            var key = targetKeys_1[_a];
            var additionalInfoFields = [];
            if (additionalInfoFields.includes(key) &&
                !keysToCheck.includes(key) &&
                key !== 'contained' &&
                target[key] !== undefined) {
                ops.push({
                    op: 'remove',
                    path: "/".concat(key),
                });
            }
        }
    }
    return ops;
};
var getPolicyHolderRelationshipCodeableConcept = function (relationship) {
    var relationshipCode = utils_1.SUBSCRIBER_RELATIONSHIP_CODE_MAP[relationship] || 'other';
    return {
        coding: [
            {
                system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                code: relationshipCode,
                display: relationship,
            },
        ],
    };
};
var createContainedGuarantor = function (guarantor, patientId) {
    var guarantorId = 'accountGuarantorId';
    var policyHolderName = (0, utils_1.createFhirHumanName)(guarantor.firstName, undefined, guarantor.lastName);
    var relationshipCode = utils_1.SUBSCRIBER_RELATIONSHIP_CODE_MAP[guarantor.relationship] || 'other';
    var number = guarantor.number;
    var email = guarantor.email;
    var telecom;
    if (number || email) {
        telecom = [];
    }
    if (number) {
        telecom === null || telecom === void 0 ? void 0 : telecom.push({
            value: (0, utils_1.formatPhoneNumber)(number),
            system: 'phone',
        });
    }
    if (email) {
        telecom === null || telecom === void 0 ? void 0 : telecom.push({
            value: email,
            system: 'email',
        });
    }
    return {
        resourceType: 'RelatedPerson',
        id: guarantorId,
        name: policyHolderName ? policyHolderName : undefined,
        birthDate: guarantor.dob,
        gender: (0, utils_1.mapBirthSexToGender)(guarantor.birthSex),
        telecom: telecom,
        patient: { reference: "Patient/".concat(patientId) },
        address: [guarantor.address],
        relationship: [
            {
                coding: [
                    {
                        system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                        code: relationshipCode,
                        display: guarantor.relationship,
                    },
                ],
            },
        ],
    };
};
exports.createContainedGuarantor = createContainedGuarantor;
var replaceCurrentGuarantor = function (newGuarantor, currentGuarantors, timestamp) {
    var combined = (0, utils_1.deduplicateObjectsByStrictKeyValEquality)(__spreadArray([newGuarantor], currentGuarantors, true));
    var periodEnd = timestamp !== null && timestamp !== void 0 ? timestamp : luxon_1.DateTime.now().toISO();
    return combined.map(function (guarantor, idx) {
        var _a, _b, _c;
        if (idx !== 0) {
            return __assign(__assign({}, guarantor), { period: __assign(__assign({}, ((_a = guarantor.period) !== null && _a !== void 0 ? _a : {})), { end: ((_b = guarantor.period) === null || _b === void 0 ? void 0 : _b.end) ? (_c = guarantor.period) === null || _c === void 0 ? void 0 : _c.end : periodEnd }) });
        }
        return guarantor;
    });
};
// this function is exported for testing purposes
var getCoverageUpdateResourcesFromUnbundled = function (input) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var patient = input.patient, unfilteredResources = input.resources;
    var resources = (0, deduplicateUnbundledResources_1.deduplicateUnbundledResources)(unfilteredResources);
    var accountResources = resources.filter(function (res) { return res.resourceType === 'Account'; });
    var coverageResources = resources.filter(function (res) { return res.resourceType === 'Coverage'; });
    var existingAccount;
    var existingGuarantorResource;
    var workersCompAccount;
    var occupationalMedicineAccount;
    if (accountResources.length > 0) {
        existingAccount = accountResources.find(function (account) { return (0, exports.accountMatchesType)(account, utils_1.PATIENT_BILLING_ACCOUNT_TYPE); });
        workersCompAccount = accountResources.find(function (account) { return (0, exports.accountMatchesType)(account, utils_1.WORKERS_COMP_ACCOUNT_TYPE); });
        occupationalMedicineAccount = accountResources.find(function (account) {
            return (0, exports.accountMatchesType)(account, utils_1.OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE);
        });
        if (!existingAccount) {
            existingAccount = accountResources.find(function (account) {
                return !(0, exports.accountMatchesType)(account, utils_1.WORKERS_COMP_ACCOUNT_TYPE) &&
                    !(0, exports.accountMatchesType)(account, utils_1.OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE);
            });
        }
    }
    var employerOrganization = resources.find(function (res) {
        return res.resourceType === 'Organization' &&
            organizationMatchesType(res, (0, utils_1.codeableConcept)('workers-comp-employer', utils_1.FHIR_EXTENSION.Organization.organizationType.url));
    });
    var occupationalMedicineEmployerOrganization = resources.find(function (res) {
        return res.resourceType === 'Organization' &&
            organizationMatchesType(res, (0, utils_1.codeableConcept)('occupational-medicine-employer', utils_1.FHIR_EXTENSION.Organization.organizationType.url));
    });
    var attorneyRelatedPerson = resources.find(function (res) {
        var _a;
        return res.resourceType === 'RelatedPerson' &&
            Boolean((_a = res.relationship) === null || _a === void 0 ? void 0 : _a.some(function (rel) { var _a; return (_a = rel.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.code === 'OTHER' && coding.display === 'MVA Attorney'; }); }));
    });
    var existingCoverages = {};
    if (existingAccount) {
        var guarantorReference = (_c = (_b = (_a = existingAccount.guarantor) === null || _a === void 0 ? void 0 : _a.find(function (gRef) {
            var _a;
            return ((_a = gRef.period) === null || _a === void 0 ? void 0 : _a.end) === undefined;
        })) === null || _b === void 0 ? void 0 : _b.party) === null || _c === void 0 ? void 0 : _c.reference;
        if (guarantorReference) {
            existingGuarantorResource = (0, utils_1.takeContainedOrFind)(guarantorReference, resources, existingAccount);
        }
        (_d = existingAccount.coverage) === null || _d === void 0 ? void 0 : _d.forEach(function (cov) {
            var coverage = coverageResources.find(function (c) { var _a, _b; return c.id === ((_b = (_a = cov.coverage) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1]); });
            if (coverage) {
                if (cov.priority === 1) {
                    existingCoverages.primary = coverage;
                }
                else if (cov.priority === 2) {
                    existingCoverages.secondary = coverage;
                }
            }
        });
    }
    else {
        // find the free-floating existing coverages
        var primaryCoverages = coverageResources
            .filter(function (cov) { return cov.order === 1 && cov.status === 'active'; })
            .sort(function (covA, covB) {
            var _a, _b;
            var covALastUpdate = (_a = covA.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated;
            var covBLastUpdate = (_b = covB.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated;
            if (covALastUpdate && covBLastUpdate) {
                var covALastUpdateDate = luxon_1.DateTime.fromISO(covALastUpdate);
                var covBLastUpdateDate = luxon_1.DateTime.fromISO(covBLastUpdate);
                if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
                    return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
                }
            }
            return 0;
        });
        var secondaryCoverages = coverageResources
            .filter(function (cov) { return cov.order === 2 && cov.status === 'active'; })
            .sort(function (covA, covB) {
            var _a, _b;
            var covALastUpdate = (_a = covA.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated;
            var covBLastUpdate = (_b = covB.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated;
            if (covALastUpdate && covBLastUpdate) {
                var covALastUpdateDate = luxon_1.DateTime.fromISO(covALastUpdate);
                var covBLastUpdateDate = luxon_1.DateTime.fromISO(covBLastUpdate);
                if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
                    return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
                }
            }
            return 0;
        });
        if (primaryCoverages.length) {
            existingCoverages.primary = primaryCoverages[0];
        }
        if (secondaryCoverages.length) {
            existingCoverages.secondary = secondaryCoverages[0];
        }
    }
    if (workersCompAccount === null || workersCompAccount === void 0 ? void 0 : workersCompAccount.coverage) {
        existingCoverages.workersComp = coverageResources.find(function (coverage) {
            var _a, _b, _c, _d;
            return coverage.id === ((_d = (_c = (_b = (_a = workersCompAccount === null || workersCompAccount === void 0 ? void 0 : workersCompAccount.coverage) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')[1]);
        });
    }
    var primarySubscriberReference = (_f = (_e = existingCoverages.primary) === null || _e === void 0 ? void 0 : _e.subscriber) === null || _f === void 0 ? void 0 : _f.reference;
    if (primarySubscriberReference && existingCoverages.primary) {
        var subscriberResult = (0, utils_1.takeContainedOrFind)(primarySubscriberReference, resources, existingCoverages.primary);
        // console.log('checked primary subscriber reference:', subscriberResult);
        existingCoverages.primarySubscriber = subscriberResult;
    }
    var secondarySubscriberReference = (_h = (_g = existingCoverages.secondary) === null || _g === void 0 ? void 0 : _g.subscriber) === null || _h === void 0 ? void 0 : _h.reference;
    if (secondarySubscriberReference && existingCoverages.secondary) {
        var subscriberResult = (0, utils_1.takeContainedOrFind)(secondarySubscriberReference, resources, existingCoverages.secondary);
        // console.log('checked secondary subscriber reference:', subscriberResult);
        existingCoverages.secondarySubscriber = subscriberResult;
    }
    var insuranceOrgs = resources.filter(function (res) {
        return res.resourceType === 'Organization' &&
            organizationMatchesType(res, (0, utils_1.codeableConcept)('pay', utils_1.FHIR_EXTENSION.Organization.organizationType.url));
    });
    var emergencyContactResource = resources.find(function (res) {
        var _a;
        return (res.resourceType === 'RelatedPerson' &&
            ((_a = res.relationship) === null || _a === void 0 ? void 0 : _a.some(function (rel) {
                var _a;
                return (_a = rel.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.code === 'EP' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131'; });
            }))) ||
            false;
    });
    return {
        patient: patient,
        account: existingAccount,
        workersCompAccount: workersCompAccount,
        occupationalMedicineAccount: occupationalMedicineAccount,
        employerOrganization: employerOrganization,
        occupationalMedicineEmployerOrganization: occupationalMedicineEmployerOrganization,
        attorneyRelatedPerson: attorneyRelatedPerson,
        coverages: existingCoverages,
        insuranceOrgs: insuranceOrgs,
        guarantorResource: existingGuarantorResource,
        emergencyContactResource: emergencyContactResource,
    };
};
exports.getCoverageUpdateResourcesFromUnbundled = getCoverageUpdateResourcesFromUnbundled;
var InsuranceCarrierKeys;
(function (InsuranceCarrierKeys) {
    InsuranceCarrierKeys["primary"] = "insurance-carrier";
    InsuranceCarrierKeys["secondary"] = "insurance-carrier-2";
    InsuranceCarrierKeys["workersComp"] = "workers-comp-insurance-name";
})(InsuranceCarrierKeys || (InsuranceCarrierKeys = {}));
var getAccountAndCoverageResourcesForPatient = function (patientId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var accountAndCoverageResources, patientResource, resources;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.time('querying for Patient account resources');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Patient',
                        params: [
                            {
                                name: '_id',
                                value: patientId,
                            },
                            {
                                name: '_revinclude',
                                value: 'Account:patient',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Account:owner',
                            },
                            {
                                name: '_revinclude',
                                value: 'RelatedPerson:patient',
                            },
                            {
                                name: '_revinclude',
                                value: 'Coverage:patient',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Coverage:subscriber',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Coverage:payor',
                            },
                        ],
                    })];
            case 1:
                accountAndCoverageResources = (_a.sent()).unbundle();
                console.timeEnd('querying for Patient account resources');
                console.log("fetched ".concat(accountAndCoverageResources === null || accountAndCoverageResources === void 0 ? void 0 : accountAndCoverageResources.length, " resources related to Patient/").concat(patientId));
                patientResource = accountAndCoverageResources.find(function (r) { return r.resourceType === 'Patient' && r.id === patientId; });
                resources = accountAndCoverageResources.filter(function (resource) {
                    if (resource.resourceType === 'Account') {
                        return resource.status === 'active';
                    }
                    return true;
                });
                if (!patientResource) {
                    throw utils_1.PATIENT_NOT_FOUND_ERROR;
                }
                return [2 /*return*/, (0, exports.getCoverageUpdateResourcesFromUnbundled)({
                        patient: patientResource,
                        resources: __spreadArray([], resources, true),
                    })];
        }
    });
}); };
exports.getAccountAndCoverageResourcesForPatient = getAccountAndCoverageResourcesForPatient;
var updatePatientAccountFromQuestionnaire = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, questionnaireResponseItem, preserveOmittedCoverages, flattenedPaperwork, insuranceOrgs, primaryInsuranceOrg, secondaryInsuranceOrg, workersCompInsuranceOrg, organizationResources, _a, patient, existingCoverages, existingAccount, existingGuarantorResource, existingEmergencyContact, existingWorkersCompAccount, existingOccupationalMedicineAccount, existingEmployerOrganization, existingAttorneyRelatedPerson, accountOperations, patch, accountPost, put, coveragePosts, emergencyContactPost, employerOrganizationPost, employerOrganizationPut, workersCompAccountPost, workersCompAccountPut, occupationalMedicineAccountPost, occupationalMedicineAccountPut, attorneyRelatedPersonPost, attorneyRelatedPersonPut, transactionRequests, bundle, error_1;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                patientId = input.patientId, questionnaireResponseItem = input.questionnaireResponseItem, preserveOmittedCoverages = input.preserveOmittedCoverages;
                flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(questionnaireResponseItem);
                insuranceOrgs = [];
                primaryInsuranceOrg = (_e = (_d = (_c = (_b = flattenedPaperwork.find(function (item) { return item.linkId === InsuranceCarrierKeys.primary; })) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueReference) === null || _e === void 0 ? void 0 : _e.reference;
                if (primaryInsuranceOrg)
                    insuranceOrgs.push(primaryInsuranceOrg);
                secondaryInsuranceOrg = (_j = (_h = (_g = (_f = flattenedPaperwork.find(function (item) { return item.linkId === InsuranceCarrierKeys.secondary; })) === null || _f === void 0 ? void 0 : _f.answer) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.valueReference) === null || _j === void 0 ? void 0 : _j.reference;
                if (secondaryInsuranceOrg)
                    insuranceOrgs.push(secondaryInsuranceOrg);
                workersCompInsuranceOrg = (_o = (_m = (_l = (_k = flattenedPaperwork.find(function (item) { return item.linkId === InsuranceCarrierKeys.workersComp; })) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueReference) === null || _o === void 0 ? void 0 : _o.reference;
                if (workersCompInsuranceOrg)
                    insuranceOrgs.push(workersCompInsuranceOrg);
                return [4 /*yield*/, searchInsuranceInformation(oystehr, insuranceOrgs)];
            case 1:
                organizationResources = _p.sent();
                return [4 /*yield*/, (0, exports.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
            case 2:
                _a = _p.sent(), patient = _a.patient, existingCoverages = _a.coverages, existingAccount = _a.account, existingGuarantorResource = _a.guarantorResource, existingEmergencyContact = _a.emergencyContactResource, existingWorkersCompAccount = _a.workersCompAccount, existingOccupationalMedicineAccount = _a.occupationalMedicineAccount, existingEmployerOrganization = _a.employerOrganization, existingAttorneyRelatedPerson = _a.attorneyRelatedPerson;
                accountOperations = (0, exports.getAccountOperations)({
                    patient: patient,
                    questionnaireResponseItem: flattenedPaperwork,
                    organizationResources: organizationResources,
                    existingCoverages: existingCoverages,
                    existingAccount: existingAccount,
                    existingGuarantorResource: existingGuarantorResource,
                    preserveOmittedCoverages: preserveOmittedCoverages,
                    existingEmergencyContact: existingEmergencyContact,
                    existingWorkersCompAccount: existingWorkersCompAccount,
                    existingOccupationalMedicineAccount: existingOccupationalMedicineAccount,
                    existingEmployerOrganization: existingEmployerOrganization,
                    existingAttorneyRelatedPerson: existingAttorneyRelatedPerson,
                });
                console.log('account and coverage operations created', JSON.stringify(accountOperations, null, 2));
                patch = accountOperations.patch, accountPost = accountOperations.accountPost, put = accountOperations.put, coveragePosts = accountOperations.coveragePosts, emergencyContactPost = accountOperations.emergencyContactPost, employerOrganizationPost = accountOperations.employerOrganizationPost, employerOrganizationPut = accountOperations.employerOrganizationPut, workersCompAccountPost = accountOperations.workersCompAccountPost, workersCompAccountPut = accountOperations.workersCompAccountPut, occupationalMedicineAccountPost = accountOperations.occupationalMedicineAccountPost, occupationalMedicineAccountPut = accountOperations.occupationalMedicineAccountPut, attorneyRelatedPersonPost = accountOperations.attorneyRelatedPersonPost, attorneyRelatedPersonPut = accountOperations.attorneyRelatedPersonPut;
                transactionRequests = __spreadArray(__spreadArray(__spreadArray([], coveragePosts, true), patch, true), put, true);
                if (employerOrganizationPost) {
                    transactionRequests.push(employerOrganizationPost);
                }
                if (employerOrganizationPut) {
                    transactionRequests.push(employerOrganizationPut);
                }
                if (attorneyRelatedPersonPost) {
                    transactionRequests.push(attorneyRelatedPersonPost);
                }
                if (attorneyRelatedPersonPut) {
                    transactionRequests.push(attorneyRelatedPersonPut);
                }
                if (workersCompAccountPut) {
                    transactionRequests.push(workersCompAccountPut);
                }
                if (occupationalMedicineAccountPut) {
                    transactionRequests.push(occupationalMedicineAccountPut);
                }
                if (accountPost) {
                    transactionRequests.push({
                        url: '/Account',
                        method: 'POST',
                        resource: accountPost,
                    });
                }
                if (workersCompAccountPost) {
                    transactionRequests.push({
                        url: '/Account',
                        method: 'POST',
                        resource: workersCompAccountPost,
                    });
                }
                if (occupationalMedicineAccountPost) {
                    transactionRequests.push({
                        url: '/Account',
                        method: 'POST',
                        resource: occupationalMedicineAccountPost,
                    });
                }
                if (emergencyContactPost) {
                    transactionRequests.push(emergencyContactPost);
                }
                _p.label = 3;
            case 3:
                _p.trys.push([3, 5, , 6]);
                console.time('updating account resources');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: transactionRequests })];
            case 4:
                bundle = _p.sent();
                console.timeEnd('updating account resources');
                // return the bundle to allow writing AuditEvents, etc.
                return [2 /*return*/, bundle];
            case 5:
                error_1 = _p.sent();
                console.log("Failed to update Account: ".concat(JSON.stringify(error_1)));
                throw error_1;
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.updatePatientAccountFromQuestionnaire = updatePatientAccountFromQuestionnaire;
var updateStripeCustomer = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var guarantorResource, account, stripeClient, email, name, phone, stripeCustomerAccountPairs, _i, stripeCustomerAccountPairs_1, pair;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                guarantorResource = input.guarantorResource, account = input.account, stripeClient = input.stripeClient;
                console.log('updating Stripe customer for account', account.id);
                console.log('guarantor resource:', "".concat(guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.resourceType, "/").concat(guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.id));
                email = (0, utils_1.getEmailForIndividual)(guarantorResource);
                name = (0, utils_1.getFullName)(guarantorResource);
                phone = (0, utils_1.getPhoneNumberForIndividual)(guarantorResource);
                stripeCustomerAccountPairs = (0, utils_1.getAllStripeCustomerAccountPairs)(account);
                _i = 0, stripeCustomerAccountPairs_1 = stripeCustomerAccountPairs;
                _a.label = 1;
            case 1:
                if (!(_i < stripeCustomerAccountPairs_1.length)) return [3 /*break*/, 4];
                pair = stripeCustomerAccountPairs_1[_i];
                return [4 /*yield*/, stripeClient.customers.update(pair.customerId, {
                        email: email,
                        name: name,
                        phone: phone,
                    }, { stripeAccount: pair.stripeAccount })];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.updateStripeCustomer = updateStripeCustomer;
function getAnswer(linkId, items) {
    var _a, _b;
    return (_b = (_a = items.find(function (data) { return data.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0];
}
