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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var visit_label_pdf_1 = require("../../shared/pdf/visit-label-pdf");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'get-or-create-visit-label-pdf';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId, secrets, oystehr, labelDocRefs, resources, patients, appointments, patient, labelConfig, _b, presignedURL, documentReference, labelDocRef, url, _c, _d, error_1, ENVIRONMENT;
    var _e, _f;
    var _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                _l.trys.push([0, 8, , 9]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), encounterId = _a.encounterId, secrets = _a.secrets;
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _l.sent();
                console.log('token', m2mToken);
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DocumentReference',
                        params: [
                            { name: 'encounter', value: "Encounter/".concat(encounterId) },
                            { name: 'status', value: 'current' },
                            { name: 'type', value: visit_label_pdf_1.VISIT_LABEL_DOC_REF_DOCTYPE.code },
                        ],
                    })];
            case 2:
                labelDocRefs = (_l.sent()).unbundle();
                if (!!labelDocRefs.length) return [3 /*break*/, 5];
                // we should create the pdf. Need patient & appointment info
                console.log("No docRefs found for Encounter/".concat(encounterId, ". Making new label"));
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:subject',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 3:
                resources = (_l.sent()).unbundle();
                patients = resources.filter(function (resource) { return resource.resourceType === 'Patient'; });
                appointments = resources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                if (patients.length !== 1 || appointments.length !== 1) {
                    throw new Error("Error fetching patient, encounter, or appointment for Encounter/".concat(encounterId));
                }
                patient = patients[0];
                labelConfig = {
                    labelConfig: utils_1.DYMO_30334_LABEL_CONFIG,
                    content: {
                        patientId: patient.id,
                        patientFirstName: (_g = (0, utils_1.getPatientFirstName)(patient)) !== null && _g !== void 0 ? _g : '',
                        patientMiddleName: (0, utils_1.getMiddleName)(patient),
                        patientLastName: (_h = (0, utils_1.getPatientLastName)(patient)) !== null && _h !== void 0 ? _h : '',
                        patientDateOfBirth: patient.birthDate ? luxon_1.DateTime.fromISO(patient.birthDate) : undefined,
                        patientGender: (_j = patient.gender) !== null && _j !== void 0 ? _j : '',
                        visitDate: appointments[0].start ? luxon_1.DateTime.fromISO(appointments[0].start) : undefined,
                    },
                };
                return [4 /*yield*/, (0, visit_label_pdf_1.createVisitLabelPDF)(labelConfig, encounterId, secrets, m2mToken, oystehr)];
            case 4:
                _b = _l.sent(), presignedURL = _b.presignedURL, documentReference = _b.docRef;
                //  LabelPdf[] return type
                return [2 /*return*/, {
                        body: JSON.stringify([{ documentReference: documentReference, presignedURL: presignedURL }]),
                        statusCode: 200,
                    }];
            case 5:
                if (!(labelDocRefs.length === 1)) return [3 /*break*/, 7];
                labelDocRef = labelDocRefs[0];
                console.log("Found existing DocumentReference/".concat(labelDocRef.id, " for Encounter/").concat(encounterId));
                url = (_k = labelDocRef.content.find(function (content) { return content.attachment.contentType === utils_1.MIME_TYPES.PDF; })) === null || _k === void 0 ? void 0 : _k.attachment.url;
                if (!url) {
                    throw new Error("No url found matching an application/pdf for DocumentReference/".concat(labelDocRef.id));
                }
                _e = {};
                _d = (_c = JSON).stringify;
                _f = {
                    documentReference: labelDocRef
                };
                return [4 /*yield*/, (0, utils_1.getPresignedURL)(url, m2mToken)];
            case 6: return [2 /*return*/, (_e.body = _d.apply(_c, [[
                        (_f.presignedURL = _l.sent(),
                            _f)
                    ]]),
                    _e.statusCode = 200,
                    _e)];
            case 7: throw new Error("Got ".concat(labelDocRefs.length, " docRefs for Encounter/").concat(encounterId, ". Expected 0 or 1"));
            case 8:
                error_1 = _l.sent();
                console.error('get or create visit label pdf error:', JSON.stringify(error_1));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-get-or-create-visit-label-pdf', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
