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
exports.index = exports.token = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var sharedHelpers_1 = require("../sharedHelpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'update-paperwork-in-progress';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, userToken, user, _a, oystehr, _b, appointmentID, inProgress, error_1, ENVIRONMENT;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 7, , 8]);
                secrets = input.secrets;
                if (!!exports.token) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                exports.token = _d.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _d.label = 3;
            case 3:
                userToken = (_c = input.headers.Authorization) === null || _c === void 0 ? void 0 : _c.replace('Bearer ', '');
                _a = userToken;
                if (!_a) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, shared_1.getUser)(userToken, input.secrets)];
            case 4:
                _a = (_d.sent());
                _d.label = 5;
            case 5:
                user = _a;
                oystehr = (0, shared_1.createOystehrClient)(exports.token, secrets);
                console.group('validateRequestParameters');
                _b = (0, validateRequestParameters_1.validateUpdatePaperworkParams)(input), appointmentID = _b.appointmentID, inProgress = _b.inProgress;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                console.time('updating paperwork-in-progress flag');
                return [4 /*yield*/, flagPaperworkInProgress(appointmentID, inProgress, oystehr, user)];
            case 6:
                _d.sent();
                console.timeEnd('updating paperwork-in-progress flag');
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({ message: 'Successfully updated appointment paperwork' }),
                    }];
            case 7:
                error_1 = _d.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-paperwork', error_1, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });
function flagPaperworkInProgress(appointmentID, lastActive, oystehr, user) {
    return __awaiter(this, void 0, void 0, function () {
        var resources, appointment, encounter, existingFlags, patientID;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID,
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Flag:encounter',
                            },
                            {
                                name: '_elements',
                                value: 'id, participant',
                            },
                        ],
                    })];
                case 1:
                    resources = (_e.sent()).unbundle();
                    appointment = resources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                    encounter = resources.find(function (resource) { return resource.resourceType === 'Encounter' && !(0, utils_1.isFollowupEncounter)(resource); });
                    existingFlags = resources.filter(function (resource) {
                        var _a, _b;
                        return resource.resourceType === 'Flag' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'paperwork-in-progress'; })) &&
                            resource.status === 'active';
                    })
                        // Sort by most recent first
                        .sort(function (flagOne, flagTwo) {
                        var _a, _b, _c, _d;
                        var periodOne = luxon_1.DateTime.fromISO((_b = (_a = flagOne.period) === null || _a === void 0 ? void 0 : _a.start) !== null && _b !== void 0 ? _b : '');
                        var periodTwo = luxon_1.DateTime.fromISO((_d = (_c = flagTwo.period) === null || _c === void 0 ? void 0 : _c.start) !== null && _d !== void 0 ? _d : '');
                        return periodTwo.diff(periodOne).as('minutes');
                    });
                    patientID = (_d = (_c = (_b = (_a = appointment.participant) === null || _a === void 0 ? void 0 : _a.find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.includes('Patient/'); })) === null || _b === void 0 ? void 0 : _b.actor) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Patient/', '');
                    if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id) || !patientID) {
                        console.log('Skipping update to paperwork-in-progress flag. No IDs found for patient or encounter');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, sharedHelpers_1.createOrUpdateFlags)('paperwork-in-progress', existingFlags, patientID, encounter.id, lastActive, oystehr, user)];
                case 2:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    });
}
