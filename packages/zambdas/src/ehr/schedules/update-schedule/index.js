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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var m2mToken;
var ZAMBDA_NAME = 'update-schedule';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, updatedSchedule, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = (0, shared_2.validateUpdateScheduleParameters)(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                updatedSchedule = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(updatedSchedule),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-schedule', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var updateDetails, currentSchedule, definiteDailySchedule, owner, newSchedule, scheduleOverrides, closures, timezone, ownerSlug, scheduleExtension, newExtension, scheduleJson, ownerExtension, ownerIdentifier;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                updateDetails = input.updateDetails, currentSchedule = input.currentSchedule, definiteDailySchedule = input.definiteDailySchedule, owner = input.owner;
                newSchedule = updateDetails.schedule, scheduleOverrides = updateDetails.scheduleOverrides, closures = updateDetails.closures, timezone = updateDetails.timezone, ownerSlug = updateDetails.ownerSlug;
                scheduleExtension = (_a = (0, utils_1.getScheduleExtension)(currentSchedule)) !== null && _a !== void 0 ? _a : {
                    schedule: definiteDailySchedule,
                    closures: closures,
                    scheduleOverrides: {},
                };
                // console.log('new schedule', JSON.stringify(newSchedule, null, 2));
                if (newSchedule !== undefined) {
                    scheduleExtension.schedule = newSchedule;
                }
                console.log('scheduleOverrides', JSON.stringify(scheduleOverrides, null, 2));
                if (scheduleOverrides !== undefined) {
                    scheduleExtension.scheduleOverrides = scheduleOverrides;
                }
                if (closures !== undefined) {
                    scheduleExtension.closures = closures;
                }
                newExtension = ((_b = currentSchedule.extension) !== null && _b !== void 0 ? _b : []).filter(function (ext) {
                    if (ext.url === utils_1.SCHEDULE_EXTENSION_URL) {
                        return false;
                    }
                    if (timezone !== undefined && ext.url === utils_1.TIMEZONE_EXTENSION_URL) {
                        return false;
                    }
                    return true;
                });
                scheduleJson = JSON.stringify(scheduleExtension);
                newExtension.push({
                    url: utils_1.SCHEDULE_EXTENSION_URL,
                    valueString: scheduleJson,
                });
                if (timezone) {
                    newExtension.push({
                        url: utils_1.TIMEZONE_EXTENSION_URL,
                        valueString: timezone,
                    });
                }
                // todo: this isn't very "RESTful" but works for now while further decoupling the schedule from the owner a potential
                // future task. note timezone is duplication on both schedule and owner for now.
                console.log('owner slug', ownerSlug);
                if (!(owner && (timezone || ownerSlug))) return [3 /*break*/, 2];
                ownerExtension = ((_c = owner.extension) !== null && _c !== void 0 ? _c : []).filter(function (ext) {
                    if (ext.url === utils_1.TIMEZONE_EXTENSION_URL) {
                        return false;
                    }
                    return true;
                });
                ownerIdentifier = ((_d = owner.identifier) !== null && _d !== void 0 ? _d : []).filter(function (id) { return id.system !== utils_1.SLUG_SYSTEM; });
                if (timezone) {
                    ownerExtension.push({
                        url: utils_1.TIMEZONE_EXTENSION_URL,
                        valueString: timezone,
                    });
                }
                if (ownerSlug) {
                    ownerIdentifier.push({
                        system: utils_1.SLUG_SYSTEM,
                        value: ownerSlug,
                    });
                }
                return [4 /*yield*/, oystehr.fhir.update(__assign(__assign({}, owner), { extension: ownerExtension, identifier: ownerIdentifier }))];
            case 1:
                _e.sent();
                _e.label = 2;
            case 2: return [4 /*yield*/, oystehr.fhir.update(__assign(__assign({}, currentSchedule), { extension: newExtension }))];
            case 3: return [2 /*return*/, _e.sent()];
        }
    });
}); };
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleId, timezone, scheduleInput, scheduleOverrides, closures, definiteDailySchedule, schedule, scheduleExtension, _a, actorType, actorId, owner;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                scheduleId = input.scheduleId, timezone = input.timezone, scheduleInput = input.schedule, scheduleOverrides = input.scheduleOverrides, closures = input.closures;
                return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Schedule', id: scheduleId })];
            case 1:
                schedule = _f.sent();
                if (!schedule || !schedule.id) {
                    throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                }
                if (scheduleInput === undefined) {
                    scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                    if (!scheduleExtension) {
                        throw utils_1.MISSING_SCHEDULE_EXTENSION_ERROR;
                    }
                    definiteDailySchedule = scheduleExtension.schedule;
                }
                else {
                    definiteDailySchedule = scheduleInput;
                }
                _a = (_e = (_d = (_c = ((_b = schedule.actor) !== null && _b !== void 0 ? _b : [])[0]) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')) !== null && _e !== void 0 ? _e : [], actorType = _a[0], actorId = _a[1];
                console.log('actorType, actorId', actorType, actorId);
                if (!(actorType === 'Location' || actorType === 'HealthcareService' || actorType === 'Practitioner')) return [3 /*break*/, 3];
                return [4 /*yield*/, oystehr.fhir.get({ resourceType: actorType, id: actorId })];
            case 2:
                owner = _f.sent();
                _f.label = 3;
            case 3: return [2 /*return*/, {
                    currentSchedule: schedule,
                    updateDetails: {
                        timezone: timezone,
                        schedule: scheduleInput,
                        scheduleOverrides: scheduleOverrides,
                        closures: closures,
                        ownerSlug: input.slug,
                    },
                    definiteDailySchedule: definiteDailySchedule,
                    owner: owner,
                }];
        }
    });
}); };
