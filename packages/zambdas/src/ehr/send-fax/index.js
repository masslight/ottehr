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
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var shared_2 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'send-fax';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, appointmentId, faxNumber, secrets, oystehr, organizationId, bundle, patient, visitNote, patientId, media, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.group('validateRequestParameters()');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), appointmentId = _a.appointmentId, faxNumber = _a.faxNumber, secrets = _a.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters() success');
                console.log('appointmentId', appointmentId);
                console.log('faxNumber', faxNumber);
                console.group('checkOrCreateM2MClientToken() then createOystehrClient()');
                return [4 /*yield*/, (0, shared_2.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                console.groupEnd();
                console.debug('checkOrCreateM2MClientToken() then createOystehrClient() success');
                organizationId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, secrets);
                console.log('searching fhir for patient, and visit note');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentId,
                            },
                            {
                                name: '_include',
                                value: 'Appointment:actor',
                            },
                            {
                                name: '_revinclude',
                                value: 'DocumentReference:related',
                            },
                        ],
                    })];
            case 2:
                bundle = (_b.sent()).unbundle();
                patient = bundle.find(function (resource) { return resource.resourceType === 'Patient'; });
                visitNote = bundle.find(function (resource) {
                    var _a, _b;
                    return resource.resourceType === 'DocumentReference' &&
                        ((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.code === utils_1.VISIT_NOTE_SUMMARY_CODE; }));
                });
                patientId = patient === null || patient === void 0 ? void 0 : patient.id;
                media = visitNote === null || visitNote === void 0 ? void 0 : visitNote.content[0].attachment.url;
                if (!patientId || !media) {
                    return [2 /*return*/, {
                            body: JSON.stringify({ message: 'Patient or visit note url not found' }),
                            statusCode: 404,
                        }];
                }
                console.log('patient id', patient.id);
                console.log('media url', media);
                console.log('Sending fax to', faxNumber);
                return [4 /*yield*/, oystehr.fax.send({
                        media: media,
                        quality: 'standard',
                        patient: "Patient/".concat(patientId),
                        recipientNumber: faxNumber,
                        sender: "Organization/".concat(organizationId),
                    })];
            case 3:
                _b.sent();
                console.log('Fax sent successfully');
                return [2 /*return*/, {
                        body: JSON.stringify('Fax sent'),
                        statusCode: 200,
                    }];
            case 4:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('send-fax', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
