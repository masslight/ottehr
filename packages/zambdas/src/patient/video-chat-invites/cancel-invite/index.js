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
var jsonpath_plus_1 = require("jsonpath-plus");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('cancel-invite', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var authorization, validatedParameters, appointmentId, emailAddress, phoneNumber, secrets, user, error_1, oystehr, appointment, encounter, relatedPersons, relatedPersonFoundByEmail, relatedPersonFoundByNumber, relatedPerson_1, participants, remainingParticipants, error_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 12, , 13]);
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
                appointmentId = validatedParameters.appointmentId, emailAddress = validatedParameters.emailAddress, phoneNumber = validatedParameters.phoneNumber, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                user = void 0;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 2:
                user = _b.sent();
                console.log("user: ".concat(user.name));
                return [3 /*break*/, 4];
            case 3:
                error_1 = _b.sent();
                console.log('getUser error:', error_1);
                return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
            case 4:
                if (!!oystehrToken) return [3 /*break*/, 6];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 5:
                oystehrToken = _b.sent(); // keeping token externally for reuse
                return [3 /*break*/, 7];
            case 6:
                console.log('already have a token, no need to update');
                _b.label = 7;
            case 7:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.log("getting appointment resource for id ".concat(appointmentId));
                return [4 /*yield*/, (0, utils_1.getAppointmentResourceById)(appointmentId, oystehr)];
            case 8:
                appointment = _b.sent();
                if (!appointment) {
                    console.log('Appointment is not found');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(404, { message: 'Appointment is not found' })];
                }
                return [4 /*yield*/, (0, shared_1.getVideoEncounterForAppointment)(appointment.id || 'Unknown', oystehr)];
            case 9:
                encounter = _b.sent();
                if (!encounter || !encounter.id) {
                    throw new Error('Encounter not found.'); // 500
                }
                return [4 /*yield*/, (0, shared_1.searchInvitedParticipantResourcesByEncounterId)(encounter.id, oystehr)];
            case 10:
                relatedPersons = _b.sent();
                relatedPersonFoundByEmail = findParticipantByEmail(relatedPersons, emailAddress);
                if (relatedPersonFoundByEmail)
                    console.log("Found RelatedPerson for provided email: RelatedPerson/".concat(relatedPersonFoundByEmail.id));
                relatedPersonFoundByNumber = findParticipantByNumber(relatedPersons, phoneNumber);
                if (relatedPersonFoundByNumber)
                    console.log("Found RelatedPerson for provided number: RelatedPerson/".concat(relatedPersonFoundByNumber.id));
                relatedPerson_1 = relatedPersonFoundByEmail || relatedPersonFoundByNumber;
                if (!relatedPerson_1) {
                    console.log('Invite is not found.');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(404, { message: 'Invite is not found.' })];
                }
                participants = __spreadArray([], ((_a = encounter.participant) !== null && _a !== void 0 ? _a : []), true);
                remainingParticipants = participants.filter(function (p) { var _a; return ((_a = p.individual) === null || _a === void 0 ? void 0 : _a.reference) !== "RelatedPerson/".concat(relatedPerson_1.id); });
                console.log('Remaining participants:', remainingParticipants);
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Encounter',
                        id: encounter.id,
                        operations: [
                            {
                                op: 'replace',
                                path: '/participant',
                                value: remainingParticipants,
                            },
                        ],
                    })];
            case 11:
                _b.sent();
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, {})];
            case 12:
                error_2 = _b.sent();
                console.log(error_2);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('cancel-invite', error_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 13: return [2 /*return*/];
        }
    });
}); });
function findParticipantByEmail(participants, matchingEmail) {
    return participants.find(function (p) {
        var email = (0, jsonpath_plus_1.JSONPath)({ path: '$.telecom[?(@.system == "email")].value', json: p })[0];
        return email === matchingEmail;
    });
}
function findParticipantByNumber(participants, matchingNumber) {
    return participants.find(function (p) {
        var number = (0, jsonpath_plus_1.JSONPath)({ path: '$.telecom[?(@.system == "sms")].value', json: p })[0];
        return number === matchingNumber;
    });
}
