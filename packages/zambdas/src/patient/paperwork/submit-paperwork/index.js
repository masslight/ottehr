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
exports.index = exports.token = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var userAuditLog_1 = require("../../../shared/userAuditLog");
var validateRequestParameters_1 = require("../validateRequestParameters");
exports.index = (0, shared_1.wrapHandler)('submit-paperwork', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, effectInput, qr, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                secrets = input.secrets;
                if (!!exports.token) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                exports.token = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _a.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(exports.token, secrets);
                return [4 /*yield*/, (0, validateRequestParameters_1.validateSubmitInputs)(input, oystehr)];
            case 4:
                effectInput = _a.sent();
                console.log('effect input', JSON.stringify(effectInput));
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 5:
                qr = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(qr),
                    }];
            case 6:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('submit-paperwork', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var updatedAnswers, questionnaireResponseId, ipAddress, secrets, currentQRStatus, appointmentId, newStatus, updatePaperworkAndAppointment, patchedPaperwork, patientId, e_1;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                updatedAnswers = input.updatedAnswers, questionnaireResponseId = input.questionnaireResponseId, ipAddress = input.ipAddress, secrets = input.secrets, currentQRStatus = input.currentQRStatus, appointmentId = input.appointmentId;
                newStatus = 'completed';
                if (currentQRStatus === 'completed' || currentQRStatus === 'amended') {
                    newStatus = 'amended';
                }
                updatePaperworkAndAppointment = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var paperworkPromise, appointmentPromise;
                    return __generator(this, function (_a) {
                        paperworkPromise = oystehr.fhir.patch({
                            id: questionnaireResponseId,
                            resourceType: 'QuestionnaireResponse',
                            operations: [
                                {
                                    op: 'add',
                                    path: '/item',
                                    value: updatedAnswers,
                                },
                                {
                                    op: 'replace',
                                    path: '/status',
                                    value: newStatus,
                                },
                                {
                                    op: 'add',
                                    path: '/authored',
                                    value: luxon_1.DateTime.now().toISO(),
                                },
                                {
                                    op: 'add',
                                    path: '/extension',
                                    value: [
                                        __assign(__assign({}, utils_1.FHIR_EXTENSION.Paperwork.submitterIP), { valueString: ipAddress }),
                                    ],
                                },
                            ],
                        });
                        appointmentPromise = (function () { return __awaiter(void 0, void 0, void 0, function () {
                            var appointment, appointmentStatus, isOttehrTm, e_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!appointmentId)
                                            return [2 /*return*/, null];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, oystehr.fhir.get({
                                                resourceType: 'Appointment',
                                                id: appointmentId,
                                            })];
                                    case 2:
                                        appointment = _a.sent();
                                        appointmentStatus = appointment.status;
                                        isOttehrTm = (0, utils_1.isTelemedAppointment)(appointment);
                                        if (isOttehrTm && appointmentStatus === 'proposed') {
                                            return [2 /*return*/, oystehr.fhir.patch({
                                                    id: appointmentId,
                                                    resourceType: 'Appointment',
                                                    operations: [
                                                        {
                                                            op: 'replace',
                                                            path: '/status',
                                                            value: 'arrived',
                                                        },
                                                    ],
                                                })];
                                        }
                                        return [2 /*return*/, null];
                                    case 3:
                                        e_2 = _a.sent();
                                        console.log('error updating appointment status', JSON.stringify(e_2, null, 2));
                                        (0, aws_serverless_1.captureException)(e_2);
                                        return [2 /*return*/, null];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); })();
                        return [2 /*return*/, Promise.all([paperworkPromise, appointmentPromise])];
                    });
                }); };
                return [4 /*yield*/, updatePaperworkAndAppointment()];
            case 1:
                patchedPaperwork = (_d.sent())[0];
                patientId = (_c = (_b = (_a = patchedPaperwork === null || patchedPaperwork === void 0 ? void 0 : patchedPaperwork.subject) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Patient/', '')) !== null && _c !== void 0 ? _c : '';
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, (0, userAuditLog_1.createAuditEvent)(userAuditLog_1.AuditableZambdaEndpoints.submitPaperwork, oystehr, input, patientId, secrets)];
            case 3:
                _d.sent();
                return [3 /*break*/, 5];
            case 4:
                e_1 = _d.sent();
                console.log('error writing audit event', JSON.stringify(e_1, null, 2));
                (0, aws_serverless_1.captureException)(e_1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/, patchedPaperwork];
        }
    });
}); };
