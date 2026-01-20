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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var m2mToken;
var ZAMBDA_NAME = 'list-schedule-owners';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, ownerType, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                ownerType = validatedParameters.ownerType;
                effectInput = void 0;
                if (!(ownerType === 'HealthcareService')) return [3 /*break*/, 3];
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                return [3 /*break*/, 7];
            case 3:
                if (!(ownerType === 'Location')) return [3 /*break*/, 5];
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 4:
                effectInput = _a.sent();
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 6:
                effectInput = _a.sent();
                _a.label = 7;
            case 7:
                response = performEffect(effectInput);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('list-schedule-owners', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) {
    var list = input.list
        .map(function (item) {
        var _a;
        var owner = item.owner, schedules = item.schedules;
        var address;
        if (owner.resourceType === 'Location') {
            address = owner.address;
        }
        else if (owner.resourceType === 'Practitioner') {
            address = (_a = owner.address) === null || _a === void 0 ? void 0 : _a[0];
        }
        var addressString = address ? (0, shared_2.addressStringFromAddress)(address) : '';
        return {
            owner: {
                resourceType: owner.resourceType,
                id: owner.id,
                name: (0, shared_2.getNameForOwner)(owner),
                address: addressString !== null && addressString !== void 0 ? addressString : '',
            },
            schedules: schedules.map(function (schedule) {
                var _a;
                return ({
                    resourceType: schedule.resourceType,
                    timezone: (_a = (0, utils_1.getTimezone)(schedule)) !== null && _a !== void 0 ? _a : utils_1.TIMEZONES[0],
                    id: schedule.id,
                    upcomingScheduleChanges: getItemOverrideInformation(schedule),
                    todayHoursISO: getHoursOfOperationForToday(schedule),
                });
            }),
        };
    })
        .sort(function (a, b) {
        return a.owner.name.localeCompare(b.owner.name);
    });
    return { list: list };
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var ownerType = JSON.parse(input.body).ownerType;
    if (!ownerType) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['ownerType']);
    }
    if (['Location', 'Practitioner', 'HealthcareService'].includes(ownerType) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"ownerType" must be one of: "Location", "Practitioner", "HealthcareService"');
    }
    return {
        secrets: secrets,
        ownerType: ownerType,
    };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var ownerType, ownerParams, _a, scheduleRes, ownerRes, schedules, owners, scheduleOwnerMap, list;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ownerType = input.ownerType;
                ownerParams = [
                    {
                        name: '_count',
                        value: '1000',
                    },
                ];
                return [4 /*yield*/, Promise.all([
                        oystehr.fhir.search({
                            resourceType: 'Schedule',
                            params: [
                                {
                                    name: 'actor:missing',
                                    value: 'false',
                                },
                                {
                                    name: 'active',
                                    value: 'true',
                                },
                            ],
                        }),
                        oystehr.fhir.search({
                            resourceType: ownerType,
                            params: ownerParams,
                        }),
                    ])];
            case 1:
                _a = _b.sent(), scheduleRes = _a[0], ownerRes = _a[1];
                schedules = scheduleRes.unbundle();
                owners = ownerRes.unbundle();
                scheduleOwnerMap = schedules.reduce(function (acc, schedule) {
                    var _a, _b;
                    var ownerRef = (_b = (_a = schedule.actor) === null || _a === void 0 ? void 0 : _a.find(function (actor) { return actor.reference; })) === null || _b === void 0 ? void 0 : _b.reference;
                    var ownerId = ownerRef === null || ownerRef === void 0 ? void 0 : ownerRef.split('/')[1];
                    if (ownerId) {
                        var current = acc.get(ownerId) || [];
                        current.push(schedule);
                        acc.set(ownerId, current);
                    }
                    return acc;
                }, new Map());
                list = owners.map(function (owner) {
                    var _a;
                    var schedules = (_a = scheduleOwnerMap.get(owner.id)) !== null && _a !== void 0 ? _a : [];
                    return {
                        owner: owner,
                        schedules: schedules,
                    };
                });
                return [2 /*return*/, { list: list }];
        }
    });
}); };
var getHoursOfOperationForToday = function (item) {
    var _a;
    var tz = (_a = (0, utils_1.getTimezone)(item)) !== null && _a !== void 0 ? _a : utils_1.TIMEZONES[0];
    var dayOfWeek = luxon_1.DateTime.now().setZone(tz).toLocaleString({ weekday: 'long' }, { locale: 'en-US' }).toLowerCase();
    var scheduleTemp = (0, utils_1.getScheduleExtension)(item);
    if (!scheduleTemp) {
        return undefined;
    }
    var scheduleDays = scheduleTemp.schedule;
    var scheduleDay = scheduleDays[dayOfWeek];
    var open = scheduleDay.open;
    var close = scheduleDay.close;
    var scheduleOverrides = scheduleTemp.scheduleOverrides;
    if (scheduleTemp.scheduleOverrides) {
        for (var dateKey in scheduleOverrides) {
            if (Object.hasOwnProperty.call(scheduleOverrides, dateKey)) {
                var date = luxon_1.DateTime.fromFormat(dateKey, utils_1.OVERRIDE_DATE_FORMAT).setZone(tz).toISODate();
                var todayDate = luxon_1.DateTime.now().setZone(tz).toISODate();
                if (date === todayDate) {
                    open = scheduleOverrides[dateKey].open;
                    close = scheduleOverrides[dateKey].close;
                }
            }
        }
    }
    if (open !== undefined && close !== undefined) {
        var openTime = luxon_1.DateTime.now().setZone(tz).startOf('day').plus({ hours: open }).toISO();
        var closeTime = luxon_1.DateTime.now().setZone(tz).startOf('day').plus({ hours: close }).toISO();
        if (!openTime || !closeTime) {
            return undefined;
        }
        return {
            open: openTime,
            close: closeTime,
        };
    }
    return undefined;
};
function getItemOverrideInformation(item) {
    var scheduleTemp = (0, utils_1.getScheduleExtension)(item);
    if (!scheduleTemp) {
        return undefined;
    }
    if (scheduleTemp) {
        var scheduleOverrides = scheduleTemp.scheduleOverrides, closures = scheduleTemp.closures;
        var overrideDates = scheduleOverrides ? Object.keys(scheduleOverrides).reduce(validateOverrideDates, []) : [];
        var closureDates = closures ? closures.reduce(validateClosureDates, []) : [];
        var allDates = __spreadArray(__spreadArray([], overrideDates, true), closureDates, true).sort(function (d1, d2) {
            // compare the single day or the first day in the period
            var startDateOne = d1.split('-')[0];
            var startDateTwo = d2.split('-')[0];
            return (luxon_1.DateTime.fromFormat(startDateOne, utils_1.SCHEDULE_CHANGES_DATE_FORMAT).toSeconds() -
                luxon_1.DateTime.fromFormat(startDateTwo, utils_1.SCHEDULE_CHANGES_DATE_FORMAT).toSeconds());
        });
        var scheduleChangesSet = new Set(allDates);
        var scheduleChanges = Array.from(scheduleChangesSet);
        return scheduleChanges.length ? scheduleChanges.join(', ') : undefined;
    }
    return undefined;
}
var validateOverrideDates = function (overrideDates, date) {
    var luxonDate = luxon_1.DateTime.fromFormat(date, utils_1.OVERRIDE_DATE_FORMAT);
    if (luxonDate.isValid && luxonDate >= luxon_1.DateTime.now().startOf('day')) {
        overrideDates.push(luxonDate.toFormat(utils_1.SCHEDULE_CHANGES_DATE_FORMAT));
    }
    return overrideDates;
};
var validateClosureDates = function (closureDates, closure) {
    var today = luxon_1.DateTime.now().startOf('day');
    var startDate = luxon_1.DateTime.fromFormat(closure.start, utils_1.OVERRIDE_DATE_FORMAT);
    if (!startDate.isValid) {
        return closureDates;
    }
    if (closure.type === utils_1.ClosureType.OneDay) {
        if (startDate >= today) {
            closureDates.push(startDate.toFormat(utils_1.SCHEDULE_CHANGES_DATE_FORMAT));
        }
    }
    else if (closure.type === utils_1.ClosureType.Period) {
        var endDate = luxon_1.DateTime.fromFormat(closure.end, utils_1.OVERRIDE_DATE_FORMAT);
        if (startDate >= today || endDate >= today) {
            closureDates.push("".concat(startDate.toFormat(utils_1.SCHEDULE_CHANGES_DATE_FORMAT), " - ").concat(endDate.toFormat(utils_1.SCHEDULE_CHANGES_DATE_FORMAT)));
        }
    }
    return closureDates;
};
