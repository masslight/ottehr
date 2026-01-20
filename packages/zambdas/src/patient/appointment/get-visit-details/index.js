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
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'get-visit-details';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentId, secrets, oystehr_1, encounter, appointmentTime, allEncounters, encounterResults, appointment, error_1, documents, error_2, medications, error_3, followUps, getEncounterSortValue_1, sortedFollowups, error_4, response, error_5, ENVIRONMENT;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 19, , 20]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentId = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, secrets)];
            case 1:
                oystehrToken = _d.sent();
                oystehr_1 = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                encounter = null;
                appointmentTime = 'unknown date';
                allEncounters = [];
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, oystehr_1.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: 'appointment',
                                value: "Appointment/".concat(appointmentId),
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 3:
                encounterResults = (_d.sent()).unbundle();
                allEncounters = encounterResults.filter(function (e) { return e.resourceType === 'Encounter'; });
                // Find the main encounter (not follow-up)
                encounter = allEncounters.find(function (e) { return !(0, utils_1.isFollowupEncounter)(e); });
                appointment = encounterResults.find(function (e) { return e.resourceType === 'Appointment'; });
                if (!encounter || !encounter.id) {
                    throw new Error('Error getting appointment encounter');
                }
                appointmentTime = (_c = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.start) !== null && _a !== void 0 ? _a : (_b = encounter === null || encounter === void 0 ? void 0 : encounter.period) === null || _b === void 0 ? void 0 : _b.start) !== null && _c !== void 0 ? _c : 'unknown date';
                return [3 /*break*/, 5];
            case 4:
                error_1 = _d.sent();
                (0, aws_serverless_1.captureException)(error_1);
                console.log('getEncounterForAppointment', error_1);
                return [3 /*break*/, 5];
            case 5:
                documents = null;
                _d.label = 6;
            case 6:
                _d.trys.push([6, 8, , 9]);
                console.log("getting presigned urls for document references files at ".concat(appointmentId));
                return [4 /*yield*/, (0, helpers_1.getPresignedURLs)(oystehr_1, oystehrToken, encounter === null || encounter === void 0 ? void 0 : encounter.id)];
            case 7:
                documents = _d.sent();
                return [3 /*break*/, 9];
            case 8:
                error_2 = _d.sent();
                console.log('getPresignedURLs', error_2);
                (0, aws_serverless_1.captureException)(error_2);
                return [3 /*break*/, 9];
            case 9:
                medications = null;
                _d.label = 10;
            case 10:
                _d.trys.push([10, 12, , 13]);
                return [4 /*yield*/, (0, helpers_1.getMedications)(oystehr_1, encounter === null || encounter === void 0 ? void 0 : encounter.id)];
            case 11:
                medications = _d.sent();
                return [3 /*break*/, 13];
            case 12:
                error_3 = _d.sent();
                (0, aws_serverless_1.captureException)(error_3);
                console.log('getMedications', error_3);
                return [3 /*break*/, 13];
            case 13:
                followUps = [];
                _d.label = 14;
            case 14:
                _d.trys.push([14, 17, , 18]);
                if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id)) return [3 /*break*/, 16];
                getEncounterSortValue_1 = function (encounterResource) {
                    var _a, _b, _c;
                    var dateString = (_b = (_a = encounterResource.period) === null || _a === void 0 ? void 0 : _a.start) !== null && _b !== void 0 ? _b : (_c = encounterResource.period) === null || _c === void 0 ? void 0 : _c.end;
                    return dateString ? new Date(dateString).getTime() : Number.POSITIVE_INFINITY;
                };
                sortedFollowups = allEncounters
                    .filter(function (e) { return (0, utils_1.isFollowupEncounter)(e); })
                    .sort(function (a, b) { return getEncounterSortValue_1(a) - getEncounterSortValue_1(b); });
                return [4 /*yield*/, Promise.all(sortedFollowups.map(function (followupEncounter) { return __awaiter(void 0, void 0, void 0, function () {
                        var followupDocuments, error_6, encounterTime;
                        var _a, _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    followupDocuments = {};
                                    _e.label = 1;
                                case 1:
                                    _e.trys.push([1, 4, , 5]);
                                    if (!followupEncounter.id) return [3 /*break*/, 3];
                                    return [4 /*yield*/, (0, helpers_1.getPresignedURLs)(oystehr_1, oystehrToken, followupEncounter.id)];
                                case 2:
                                    followupDocuments = _e.sent();
                                    _e.label = 3;
                                case 3: return [3 /*break*/, 5];
                                case 4:
                                    error_6 = _e.sent();
                                    console.log('getPresignedURLs for follow-up', error_6);
                                    (0, aws_serverless_1.captureException)(error_6);
                                    return [3 /*break*/, 5];
                                case 5:
                                    encounterTime = (_d = (_b = (_a = followupEncounter.period) === null || _a === void 0 ? void 0 : _a.start) !== null && _b !== void 0 ? _b : (_c = followupEncounter.period) === null || _c === void 0 ? void 0 : _c.end) !== null && _d !== void 0 ? _d : 'unknown date';
                                    return [2 /*return*/, {
                                            encounterTime: encounterTime,
                                            documents: followupDocuments,
                                        }];
                            }
                        });
                    }); }))];
            case 15:
                followUps = _d.sent();
                _d.label = 16;
            case 16: return [3 /*break*/, 18];
            case 17:
                error_4 = _d.sent();
                (0, aws_serverless_1.captureException)(error_4);
                console.log('getFollowUpEncounters', error_4);
                return [3 /*break*/, 18];
            case 18:
                console.log('building get appointment response');
                response = {
                    files: documents || {},
                    medications: medications || [],
                    appointmentTime: appointmentTime,
                    followUps: followUps,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 19:
                error_5 = _d.sent();
                console.log('error', error_5, error_5.issue);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_5, ENVIRONMENT)];
            case 20: return [2 /*return*/];
        }
    });
}); });
