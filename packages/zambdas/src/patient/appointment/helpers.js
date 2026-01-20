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
exports.getEncounterClass = exports.getTelemedRequiredAppointmentEncounterExtensions = exports.getCanonicalUrlForPrevisitQuestionnaire = exports.getCurrentQuestionnaireForServiceType = void 0;
exports.getRelatedResources = getRelatedResources;
var utils_1 = require("utils");
var in_person_intake_questionnaire_json_1 = require("../../../../../config/oystehr/in-person-intake-questionnaire.json");
var virtual_intake_questionnaire_json_1 = require("../../../../../config/oystehr/virtual-intake-questionnaire.json");
var harvest_1 = require("../../ehr/shared/harvest");
var getCurrentQuestionnaireForServiceType = function (serviceMode, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var canonical;
    return __generator(this, function (_a) {
        canonical = (0, exports.getCanonicalUrlForPrevisitQuestionnaire)(serviceMode);
        return [2 /*return*/, (0, utils_1.getCanonicalQuestionnaire)(canonical, oystehrClient)];
    });
}); };
exports.getCurrentQuestionnaireForServiceType = getCurrentQuestionnaireForServiceType;
var getCanonicalUrlForPrevisitQuestionnaire = function (serviceMode) {
    var url = '';
    var version = '';
    if (serviceMode === 'in-person') {
        var questionnaire = Object.values(in_person_intake_questionnaire_json_1.default.fhirResources).find(function (q) {
            return q.resource.resourceType === 'Questionnaire' &&
                q.resource.status === 'active' &&
                q.resource.url.includes('intake-paperwork-inperson');
        });
        url = (questionnaire === null || questionnaire === void 0 ? void 0 : questionnaire.resource.url) || '';
        version = (questionnaire === null || questionnaire === void 0 ? void 0 : questionnaire.resource.version) || '';
    }
    else if (serviceMode === 'virtual') {
        var questionnaire = Object.values(virtual_intake_questionnaire_json_1.default.fhirResources).find(function (q) {
            return q.resource.resourceType === 'Questionnaire' &&
                q.resource.status === 'active' &&
                q.resource.url.includes('intake-paperwork-virtual');
        });
        url = (questionnaire === null || questionnaire === void 0 ? void 0 : questionnaire.resource.url) || '';
        version = (questionnaire === null || questionnaire === void 0 ? void 0 : questionnaire.resource.version) || '';
    }
    if (!url || !version) {
        throw new Error('Questionnaire url missing or malformed');
    }
    return {
        url: url,
        version: version,
    };
};
exports.getCanonicalUrlForPrevisitQuestionnaire = getCanonicalUrlForPrevisitQuestionnaire;
var getTelemedRequiredAppointmentEncounterExtensions = function (patientRef, dateTimeNow) {
    var apptVirtualServiceExtension = {
        url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
        extension: [
            {
                url: 'channelType',
                valueCoding: {
                    system: 'https://fhir.zapehr.com/virtual-service-type',
                    code: utils_1.TELEMED_VIDEO_ROOM_CODE,
                    display: 'Twilio Video Group Rooms',
                },
            },
        ],
    };
    var encExtensions = [
        __assign(__assign({}, apptVirtualServiceExtension), { url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release' }),
        {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
            extension: [
                {
                    url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
                    extension: [
                        {
                            url: 'period',
                            valuePeriod: {
                                start: dateTimeNow,
                            },
                        },
                        {
                            url: 'reference',
                            valueReference: {
                                reference: patientRef,
                            },
                        },
                    ],
                },
            ],
        },
    ];
    return {
        apptExtensions: [apptVirtualServiceExtension],
        encExtensions: encExtensions,
    };
};
exports.getTelemedRequiredAppointmentEncounterExtensions = getTelemedRequiredAppointmentEncounterExtensions;
var getEncounterClass = function (serviceType) {
    return serviceType === 'virtual'
        ? {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'VR',
            display: 'virtual',
        }
        : {
            system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
            code: 'ACUTE',
            display: 'inpatient acute',
        };
};
exports.getEncounterClass = getEncounterClass;
function getRelatedResources(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var documents, accountInfo, _a, docsResponse, insuranceResponse, primaryCarePhysician, pharmacy;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    documents = [];
                    accountInfo = undefined;
                    if (!patientId) return [3 /*break*/, 2];
                    console.log('get related resources to pre-populate paperwork');
                    return [4 /*yield*/, Promise.all([
                            oystehr.fhir.search({
                                resourceType: 'DocumentReference',
                                params: [
                                    {
                                        name: 'related',
                                        value: "Patient/".concat(patientId),
                                    },
                                    {
                                        name: 'status',
                                        value: 'current',
                                    },
                                ],
                            }),
                            (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr),
                        ])];
                case 1:
                    _a = _f.sent(), docsResponse = _a[0], insuranceResponse = _a[1];
                    primaryCarePhysician = (_c = (_b = insuranceResponse.patient) === null || _b === void 0 ? void 0 : _b.contained) === null || _c === void 0 ? void 0 : _c.find(function (resource) { return resource.resourceType === 'Practitioner' && resource.active === true; });
                    pharmacy = (_e = (_d = insuranceResponse.patient) === null || _d === void 0 ? void 0 : _d.contained) === null || _e === void 0 ? void 0 : _e.find(function (resource) { return resource.resourceType === 'Organization' && resource.id === harvest_1.PATIENT_CONTAINED_PHARMACY_ID; });
                    documents = docsResponse.unbundle();
                    accountInfo = __assign(__assign({}, insuranceResponse), { primaryCarePhysician: primaryCarePhysician, coverageChecks: [], // these aren't needed here
                        pharmacy: pharmacy });
                    _f.label = 2;
                case 2: return [2 /*return*/, { documents: documents, accountInfo: accountInfo }];
            }
        });
    });
}
