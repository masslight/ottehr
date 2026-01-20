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
var jsonpath_plus_1 = require("jsonpath-plus");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'telemed-list-invites';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var authorization, validatedParameters, appointmentId, secrets, user, error_1, oystehr, appointment, encounter, relatedPersons, participants, result, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 11, , 12]);
                authorization = input.headers.Authorization;
                if (!authorization) {
                    console.log('User is not authenticated yet');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
                }
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                appointmentId = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                user = void 0;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 2:
                user = _a.sent();
                console.log("user: ".concat(user.name));
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.log('getUser error:', error_1);
                return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
            case 4:
                if (!!oystehrToken) return [3 /*break*/, 6];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 5:
                oystehrToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 7];
            case 6:
                console.log('already have a token, no need to update');
                _a.label = 7;
            case 7:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.log("getting appointment resource for id ".concat(appointmentId));
                return [4 /*yield*/, (0, utils_1.getAppointmentResourceById)(appointmentId, oystehr)];
            case 8:
                appointment = _a.sent();
                if (!appointment) {
                    console.log('Appointment is not found');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(404, { message: 'Appointment is not found' })];
                }
                return [4 /*yield*/, (0, shared_1.getVideoEncounterForAppointment)(appointment.id || 'Unknown', oystehr)];
            case 9:
                encounter = _a.sent();
                if (!encounter || !encounter.id) {
                    throw new Error('Encounter not found.'); // 500
                }
                return [4 /*yield*/, (0, shared_1.searchInvitedParticipantResourcesByEncounterId)(encounter.id, oystehr)];
            case 10:
                relatedPersons = _a.sent();
                participants = relatedPersons.map(function (r) {
                    var _a, _b, _c, _d, _e;
                    return ({
                        firstName: ((_b = (_a = r.name) === null || _a === void 0 ? void 0 : _a[0].given) !== null && _b !== void 0 ? _b : []).join(' '),
                        lastName: (_d = (_c = r.name) === null || _c === void 0 ? void 0 : _c[0].family) !== null && _d !== void 0 ? _d : '',
                        emailAddress: (0, jsonpath_plus_1.JSONPath)({ path: '$.telecom[?(@.system == "email")].value', json: r })[0],
                        phoneNumber: (_e = (0, jsonpath_plus_1.JSONPath)({ path: '$.telecom[?(@.system == "phone")].value', json: r })[0]) === null || _e === void 0 ? void 0 : _e.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'), // parse number "1111111111" to "(111) 111-1111"
                    });
                });
                result = { invites: participants };
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, result)];
            case 11:
                error_2 = _a.sent();
                console.log(error_2);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 12: return [2 /*return*/];
        }
    });
}); });
