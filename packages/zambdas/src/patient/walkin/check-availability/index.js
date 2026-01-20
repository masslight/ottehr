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
var shared_1 = require("../../../ehr/schedules/shared");
var shared_2 = require("../../../shared");
var oystehrToken;
exports.index = (0, shared_2.wrapHandler)('check-availability', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var fhirAPI, projectAPI, basicInput, oystehr, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                fhirAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, input.secrets);
                projectAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets);
                basicInput = validateRequestParameters(input);
                console.log('basicInput', JSON.stringify(basicInput));
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_2.getAuth0Token)(input.secrets)];
            case 1:
                oystehrToken = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _a.label = 3;
            case 3:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, fhirAPI, projectAPI);
                return [4 /*yield*/, complexValidation(basicInput, oystehr)];
            case 4:
                effectInput = _a.sent();
                response = performEffect(effectInput);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 5:
                error_1 = _a.sent();
                console.error('walkin-check-availability error', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_2.topLevelCatch)('walkin-check-availability', error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) {
    var _a, _b, _c;
    var scheduleExtension = input.scheduleExtension, serviceMode = input.serviceMode, timezone = input.timezone, scheduleOwnerName = input.scheduleOwnerName, scheduleId = input.scheduleId;
    // grab everything that is needed to perform the walkin availability check
    var timeNow = luxon_1.DateTime.now().setZone(timezone);
    var tomorrow = timeNow.plus({ days: 1 });
    var todayOpeningTime = (0, utils_1.getOpeningTime)(scheduleExtension, timezone, timeNow);
    var todayClosingTime = (0, utils_1.getClosingTime)(scheduleExtension, timezone, timeNow);
    var prebookStillOpenForToday = todayOpeningTime !== undefined && (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));
    // todo: consider just sending the closures list and allow the client to check for closure overrides for whichever days
    var officeHasClosureOverrideToday = (0, utils_1.isClosureOverride)((_a = scheduleExtension.closures) !== null && _a !== void 0 ? _a : [], timezone, timeNow);
    var officeHasClosureOverrideTomorrow = (0, utils_1.isClosureOverride)((_b = scheduleExtension.closures) !== null && _b !== void 0 ? _b : [], timezone, tomorrow);
    var officeOpen = todayOpeningTime !== undefined &&
        todayOpeningTime <= timeNow &&
        (todayClosingTime === undefined || todayClosingTime > timeNow) &&
        !officeHasClosureOverrideToday;
    var walkinOpen = isWalkinOpen({
        openingTime: todayOpeningTime,
        closingTime: todayClosingTime,
        closures: (_c = scheduleExtension.closures) !== null && _c !== void 0 ? _c : [],
        timezone: timezone,
        timeNow: timeNow,
    });
    console.log('officeOpen, walkinOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow', officeOpen, walkinOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow);
    return {
        officeOpen: officeOpen,
        walkinOpen: walkinOpen,
        officeHasClosureOverrideTomorrow: officeHasClosureOverrideTomorrow,
        officeHasClosureOverrideToday: officeHasClosureOverrideToday,
        prebookStillOpenForToday: prebookStillOpenForToday,
        serviceMode: serviceMode,
        scheduleOwnerName: scheduleOwnerName,
        scheduleId: scheduleId,
    };
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), scheduleId = _a.scheduleId, locationName = _a.locationName;
    if (!scheduleId && !locationName) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Either "scheduleId" or "scheduleName" must be provided');
    }
    if (scheduleId && (0, utils_1.isValidUUID)(scheduleId) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"scheduleId" must be a valid UUID');
    }
    if (locationName && typeof locationName !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"scheduleName" must be a string');
    }
    return { scheduleId: scheduleId, locationName: locationName };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleId, locationName, params, scheduleAndOwnerResults, scheduleOwner, actors, schedule, scheduleOwnerRef, _a, scheduleOwnerType, scheduleOwnerId, serviceMode, scheduleExtension, timezone, scheduleOwnerName, resolvedScheduleId;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                scheduleId = input.scheduleId, locationName = input.locationName;
                params = [];
                if (scheduleId) {
                    params.push.apply(params, [
                        {
                            name: '_id',
                            value: scheduleId,
                        },
                        {
                            name: '_include',
                            value: 'Schedule:actor',
                        },
                    ]);
                }
                else if (locationName) {
                    params.push.apply(params, [
                        {
                            name: 'actor:Location.name:exact',
                            value: locationName,
                        },
                        {
                            name: '_include',
                            value: 'Schedule:actor',
                        },
                    ]);
                }
                else {
                    throw new Error('Validation failed: scheduleId or scheduleName is required');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Schedule',
                        params: params,
                    })];
            case 1:
                scheduleAndOwnerResults = (_f.sent()).unbundle();
                actors = new Set(scheduleAndOwnerResults
                    .filter(function (res) {
                    return res.resourceType !== 'Schedule' && res.id !== undefined;
                })
                    .map(function (res) {
                    return "".concat(res.resourceType, "/").concat(res.id);
                }));
                schedule = scheduleAndOwnerResults.find(function (res) {
                    return (res.resourceType === 'Schedule' &&
                        res.actor.some(function (actor) {
                            var _a;
                            return actors.has((_a = actor.reference) !== null && _a !== void 0 ? _a : '');
                        }));
                });
                if (!schedule) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Schedule');
                }
                console.log('schedule', schedule.id);
                scheduleOwnerRef = (_d = (_c = (_b = schedule.actor) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference) !== null && _d !== void 0 ? _d : '';
                _a = scheduleOwnerRef.split('/'), scheduleOwnerType = _a[0], scheduleOwnerId = _a[1];
                if (scheduleOwnerType && scheduleOwnerId) {
                    scheduleOwner = scheduleAndOwnerResults.find(function (res) {
                        return "".concat(res.resourceType, "/").concat(res.id) === scheduleOwnerRef;
                    });
                }
                serviceMode = undefined;
                if (scheduleOwner) {
                    serviceMode = (0, utils_1.getServiceModeFromScheduleOwner)(scheduleOwner);
                }
                scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                if (!scheduleExtension) {
                    throw utils_1.MISSING_SCHEDULE_EXTENSION_ERROR;
                }
                timezone = (_e = (0, utils_1.getTimezone)(schedule)) !== null && _e !== void 0 ? _e : utils_1.TIMEZONES[0];
                scheduleOwnerName = '';
                if (locationName) {
                    scheduleOwnerName = locationName;
                }
                else if (scheduleOwner) {
                    scheduleOwnerName = (0, shared_1.getNameForOwner)(scheduleOwner);
                }
                resolvedScheduleId = scheduleId;
                if (!scheduleId) {
                    resolvedScheduleId = schedule.id;
                }
                if (!resolvedScheduleId) {
                    throw new Error('Schedule ID could not be resolved');
                }
                return [2 /*return*/, { scheduleExtension: scheduleExtension, timezone: timezone, serviceMode: serviceMode, scheduleOwnerName: scheduleOwnerName, scheduleId: resolvedScheduleId }];
        }
    });
}); };
function isWalkinOpen(input) {
    var openingTime = input.openingTime, closingTime = input.closingTime, closures = input.closures, timezone = input.timezone, timeNow = input.timeNow, _a = input.minutesWalkinAvailableBeforeOpening, minutesWalkinAvailableBeforeOpening = _a === void 0 ? 0 : _a;
    var officeHasClosureOverrideToday = (0, utils_1.isClosureOverride)(closures, timezone, timeNow);
    return (openingTime !== undefined &&
        openingTime.minus({ minute: minutesWalkinAvailableBeforeOpening }) <= timeNow &&
        (closingTime === undefined || closingTime > timeNow) &&
        !officeHasClosureOverrideToday);
}
