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
exports.persistTestPatient = exports.makeTestPatient = exports.cleanupTestScheduleResources = exports.getScheduleDay = exports.persistSchedule = exports.setClosingHourForAllDays = exports.adjustHoursOfOperation = exports.addOverrides = exports.addClosureDay = exports.addClosurePeriod = exports.setSlotLengthInMinutes = exports.changeAllCapacities = exports.applyBuffersToScheduleExtension = exports.DEFAULT_SCHEDULE_JSON = exports.makeLocationWithSchedule = exports.createOverrideSchedule = exports.replaceSchedule = exports.setHourlyCapacity = exports.makeSchedule = exports.tagForProcessId = exports.DEFAULT_TEST_TIMEZONE = exports.DELETABLE_RESOURCE_CODE_PREFIX = exports.makeLocation = exports.updateScheduleForDay = exports.createGenericSchedule = exports.editHoursOfOperationForDay = exports.getGenericHoursOfOperation = exports.startOfDayWithTimezone = void 0;
var crypto_1 = require("crypto");
var lodash_1 = require("lodash");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var DAYS_LONG = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
var startOfDayWithTimezone = function (input) {
    var _a, _b;
    var timezone = (_a = input === null || input === void 0 ? void 0 : input.timezone) !== null && _a !== void 0 ? _a : exports.DEFAULT_TEST_TIMEZONE;
    var baseDate = (_b = input === null || input === void 0 ? void 0 : input.date) !== null && _b !== void 0 ? _b : luxon_1.DateTime.now().setZone(timezone);
    return luxon_1.DateTime.fromFormat(baseDate.toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', { zone: timezone });
};
exports.startOfDayWithTimezone = startOfDayWithTimezone;
var getStringTime = function (hour) {
    return luxon_1.DateTime.fromObject({ hour: hour, minute: 0, second: 0 }).toFormat('HH:mm:ss');
};
var getGenericHoursOfOperation = function () {
    var openTime = getStringTime(5);
    var closeTime = getStringTime(23);
    var hoursOfOp = [];
    DAYS.forEach(function (day) {
        hoursOfOp.push({
            openingTime: openTime,
            closingTime: closeTime,
            daysOfWeek: [day],
        });
    });
    return hoursOfOp;
};
exports.getGenericHoursOfOperation = getGenericHoursOfOperation;
var editHoursOfOperationForDay = function (editDetails, hours) {
    var dayOfWeek = editDetails.dayOfWeek, open = editDetails.open, close = editDetails.close, workingDay = editDetails.workingDay;
    var dayShort = dayOfWeek.substring(0, 3);
    var hourIndex = hours.findIndex(function (hourDetail) { var _a; return (_a = hourDetail.daysOfWeek) === null || _a === void 0 ? void 0 : _a.includes(dayShort); });
    // if working day is false, the actual codebase removes that particular day entirely from hours of operation, and the logic below simulates that
    if (!workingDay && hourIndex !== -1) {
        hours.splice(hourIndex, 1);
        return hours;
    }
    if (hourIndex !== -1) {
        hours[hourIndex].openingTime = getStringTime(open);
        hours[hourIndex].closingTime = getStringTime(close);
    }
    return hours;
};
exports.editHoursOfOperationForDay = editHoursOfOperationForDay;
var createGenericSchedule = function (open, close) {
    var schedule = {};
    DAYS_LONG.forEach(function (day) {
        schedule[day] = {
            open: open,
            close: close,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: Array.from({ length: 24 }, function (_, i) {
                var capacity = 4;
                if (i < open || i >= close) {
                    capacity = 0;
                }
                return { hour: i, capacity: capacity };
            }),
        };
    });
    return schedule;
};
exports.createGenericSchedule = createGenericSchedule;
var updateScheduleForDay = function (_a) {
    var hoursInfo = _a.hoursInfo, hourlyCapacity = _a.hourlyCapacity, schedule = _a.schedule, openingBuffer = _a.openingBuffer, closingBuffer = _a.closingBuffer;
    var dayOfWeek = hoursInfo.dayOfWeek, open = hoursInfo.open, close = hoursInfo.close, workingDay = hoursInfo.workingDay;
    var adjustedClose = close === 0 ? 24 : close;
    schedule[dayOfWeek].open = open;
    schedule[dayOfWeek].close = adjustedClose;
    schedule[dayOfWeek].hours = Array.from({ length: adjustedClose - open }, function (_, i) { return ({
        hour: i + open,
        capacity: hourlyCapacity,
    }); });
    if (openingBuffer) {
        schedule[dayOfWeek].openingBuffer = openingBuffer;
    }
    if (closingBuffer) {
        schedule[dayOfWeek].closingBuffer = closingBuffer;
    }
    schedule[dayOfWeek].workingDay = workingDay;
    return schedule;
};
exports.updateScheduleForDay = updateScheduleForDay;
var makeLocation = function (operationHours) {
    return {
        resourceType: 'Location',
        id: (0, crypto_1.randomUUID)(),
        status: 'active',
        name: 'Location Test',
        description: 'Location Test',
        identifier: [
            {
                use: 'usual',
                system: utils_1.SLUG_SYSTEM,
                value: 'test-test',
            },
            {
                use: 'usual',
                system: "".concat(utils_1.FHIR_BASE_URL, "/r4/facility-name"),
                value: 'TEST',
            },
        ],
        hoursOfOperation: operationHours,
    };
};
exports.makeLocation = makeLocation;
exports.DELETABLE_RESOURCE_CODE_PREFIX = 'DELETE_ME-';
exports.DEFAULT_TEST_TIMEZONE = 'America/New_York';
var tagForProcessId = function (processId) {
    return "".concat(exports.DELETABLE_RESOURCE_CODE_PREFIX).concat(processId !== null && processId !== void 0 ? processId : '');
};
exports.tagForProcessId = tagForProcessId;
var makeSchedule = function (input) {
    var scheduleJsonString = input.scheduleJsonString, scheduleObject = input.scheduleObject, processId = input.processId, locationRef = input.locationRef, timezone = input.timezone;
    var json = '';
    if (!scheduleJsonString && !scheduleObject) {
        throw new Error('scheduleJsonString or scheduleObject must be provided');
    }
    else if (scheduleJsonString) {
        json = scheduleJsonString;
    }
    else if (scheduleObject) {
        json = JSON.stringify(scheduleObject);
    }
    return {
        resourceType: 'Schedule',
        id: (0, crypto_1.randomUUID)(),
        actor: [
            {
                reference: locationRef !== null && locationRef !== void 0 ? locationRef : "Location/".concat((0, crypto_1.randomUUID)()),
            },
        ],
        extension: [
            {
                url: 'http://hl7.org/fhir/StructureDefinition/timezone',
                valueString: timezone !== null && timezone !== void 0 ? timezone : exports.DEFAULT_TEST_TIMEZONE,
            },
            {
                url: utils_1.SCHEDULE_EXTENSION_URL,
                valueString: json,
            },
        ],
        meta: {
            tag: [
                {
                    system: 'OTTEHR_AUTOMATED_TEST',
                    code: (0, exports.tagForProcessId)(processId),
                    display: 'a test resource that should be cleaned up',
                },
            ],
        },
    };
};
exports.makeSchedule = makeSchedule;
var setHourlyCapacity = function (schedule, day, hour, capacity) {
    var _a;
    var daySchedule = schedule[day];
    var hoursToUpdate = schedule[day].hours;
    var updatedHours = hoursToUpdate.map(function (hourlyCapacity) {
        if (hourlyCapacity.hour === hour) {
            return __assign(__assign({}, hourlyCapacity), { capacity: capacity });
        }
        return hourlyCapacity;
    });
    return __assign(__assign({}, schedule), (_a = {}, _a[day] = __assign(__assign({}, daySchedule), { hours: updatedHours }), _a));
};
exports.setHourlyCapacity = setHourlyCapacity;
var replaceSchedule = function (currentSchedule, newExtension) {
    var _a;
    var scheduleIdx = (_a = currentSchedule.extension) === null || _a === void 0 ? void 0 : _a.findIndex(function (ext) { return ext.url === utils_1.SCHEDULE_EXTENSION_URL; });
    var modifiedSchedule = __assign({}, currentSchedule);
    if (scheduleIdx !== undefined && scheduleIdx >= 0 && modifiedSchedule.extension) {
        modifiedSchedule.extension[scheduleIdx] = __assign(__assign({}, modifiedSchedule.extension[scheduleIdx]), { valueString: JSON.stringify(newExtension) });
        return modifiedSchedule;
    }
    else {
        return currentSchedule;
    }
};
exports.replaceSchedule = replaceSchedule;
var createOverrideSchedule = function (scheduleOverrides, input) {
    var _a;
    var date = input.date, open = input.open, close = input.close, openingBuffer = input.openingBuffer, closingBuffer = input.closingBuffer, hourlyCapacity = input.hourlyCapacity;
    var dateString = date.toFormat(utils_1.OVERRIDE_DATE_FORMAT);
    scheduleOverrides = __assign(__assign({}, scheduleOverrides), (_a = {}, _a[dateString] = {
        open: open,
        close: close,
        openingBuffer: openingBuffer,
        closingBuffer: closingBuffer,
        hours: Array.from({ length: 24 }, function (_, i) {
            var capacity = 0;
            if (i >= open && i < close) {
                capacity = hourlyCapacity;
            }
            return { hour: i, capacity: capacity };
        }),
    }, _a));
    return scheduleOverrides;
};
exports.createOverrideSchedule = createOverrideSchedule;
var makeLocationWithSchedule = function (hoursInfo, hourlyCapacity, openingBuffer, closingBuffer, overrideInfo, closures) {
    if (closures === void 0) { closures = []; }
    var operationHours = (0, exports.getGenericHoursOfOperation)();
    var scheduleDTO;
    hoursInfo.forEach(function (hoursInfoForDay) {
        operationHours = (0, exports.editHoursOfOperationForDay)(hoursInfoForDay, operationHours);
        scheduleDTO = (0, exports.updateScheduleForDay)({
            hoursInfo: hoursInfoForDay,
            hourlyCapacity: hourlyCapacity,
            schedule: scheduleDTO !== null && scheduleDTO !== void 0 ? scheduleDTO : (0, exports.createGenericSchedule)(hoursInfoForDay.open, hoursInfoForDay.close),
            openingBuffer: openingBuffer,
            closingBuffer: closingBuffer,
        });
    });
    var scheduleOverrides = {};
    if (overrideInfo && overrideInfo.length > 0) {
        overrideInfo.map(function (override) {
            scheduleOverrides = (0, exports.createOverrideSchedule)(scheduleOverrides, override);
        });
    }
    if (!scheduleDTO) {
        throw new Error('you messed up');
    }
    var scheduleComplete = { schedule: scheduleDTO, scheduleOverrides: scheduleOverrides, closures: closures };
    var scheduleString = JSON.stringify(scheduleComplete);
    var location = (0, exports.makeLocation)(operationHours);
    var schedule = (0, exports.makeSchedule)({
        locationRef: "Location/".concat(location.id),
        scheduleJsonString: scheduleString,
        processId: (0, crypto_1.randomUUID)(),
    });
    return { location: location, schedule: schedule };
};
exports.makeLocationWithSchedule = makeLocationWithSchedule;
// 4 slots per hour, 24 hours a day
exports.DEFAULT_SCHEDULE_JSON = {
    schedule: {
        monday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        tuesday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        wednesday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        thursday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        friday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        saturday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
        sunday: {
            open: 0,
            close: 24,
            openingBuffer: 0,
            closingBuffer: 0,
            workingDay: true,
            hours: [
                {
                    hour: 0,
                    capacity: 4,
                },
                {
                    hour: 1,
                    capacity: 4,
                },
                {
                    hour: 2,
                    capacity: 4,
                },
                {
                    hour: 3,
                    capacity: 4,
                },
                {
                    hour: 4,
                    capacity: 4,
                },
                {
                    hour: 5,
                    capacity: 4,
                },
                {
                    hour: 6,
                    capacity: 4,
                },
                {
                    hour: 7,
                    capacity: 4,
                },
                {
                    hour: 8,
                    capacity: 4,
                },
                {
                    hour: 9,
                    capacity: 4,
                },
                {
                    hour: 10,
                    capacity: 4,
                },
                {
                    hour: 11,
                    capacity: 4,
                },
                {
                    hour: 12,
                    capacity: 4,
                },
                {
                    hour: 13,
                    capacity: 4,
                },
                {
                    hour: 14,
                    capacity: 4,
                },
                {
                    hour: 15,
                    capacity: 4,
                },
                {
                    hour: 16,
                    capacity: 4,
                },
                {
                    hour: 17,
                    capacity: 4,
                },
                {
                    hour: 18,
                    capacity: 4,
                },
                {
                    hour: 19,
                    capacity: 4,
                },
                {
                    hour: 20,
                    capacity: 4,
                },
                {
                    hour: 21,
                    capacity: 4,
                },
                {
                    hour: 22,
                    capacity: 4,
                },
                {
                    hour: 23,
                    capacity: 4,
                },
            ],
        },
    },
    scheduleOverrides: {},
    closures: [],
};
var applyBuffersToScheduleExtension = function (scheduleExt, bufferDef) {
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var openingBuffer = bufferDef.openingBuffer, closingBuffer = bufferDef.closingBuffer;
    var schedule = scheduleExtCopy.schedule;
    var updatedEntries = Object.entries(schedule).map(function (_a) {
        var day = _a[0], daySchedule = _a[1];
        var newOpeningBuffer = openingBuffer !== null && openingBuffer !== void 0 ? openingBuffer : daySchedule.openingBuffer;
        var newClosingBuffer = closingBuffer !== null && closingBuffer !== void 0 ? closingBuffer : daySchedule.closingBuffer;
        return [day, __assign(__assign({}, daySchedule), { openingBuffer: newOpeningBuffer, closingBuffer: newClosingBuffer })];
    });
    var scheduleNew = Object.fromEntries(updatedEntries);
    return __assign(__assign({}, scheduleExtCopy), { schedule: scheduleNew });
};
exports.applyBuffersToScheduleExtension = applyBuffersToScheduleExtension;
var changeAllCapacities = function (scheduleExt, newCapacity) {
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var schedule = scheduleExtCopy.schedule;
    var updatedEntries = Object.entries(schedule).map(function (_a) {
        var day = _a[0], daySchedule = _a[1];
        var hours = daySchedule.hours;
        var updatedHours = hours.map(function (hourObj) {
            return __assign(__assign({}, hourObj), { capacity: newCapacity });
        });
        return [day, __assign(__assign({}, daySchedule), { hours: updatedHours })];
    });
    var scheduleNew = Object.fromEntries(updatedEntries);
    return __assign(__assign({}, scheduleExtCopy), { schedule: scheduleNew });
};
exports.changeAllCapacities = changeAllCapacities;
var setSlotLengthInMinutes = function (scheduleExt, slotLength) {
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    return __assign(__assign({}, scheduleExtCopy), { slotLength: slotLength });
};
exports.setSlotLengthInMinutes = setSlotLengthInMinutes;
var addClosurePeriod = function (scheduleExt, start, lengthInDays) {
    var _a;
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var closure = {
        type: utils_1.ClosureType.Period,
        start: start.toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: start.plus({ days: lengthInDays }).toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    };
    console.log('closure: ', closure);
    return __assign(__assign({}, scheduleExtCopy), { closures: __spreadArray(__spreadArray([], ((_a = scheduleExtCopy.closures) !== null && _a !== void 0 ? _a : []), true), [closure], false) });
};
exports.addClosurePeriod = addClosurePeriod;
var addClosureDay = function (scheduleExt, start) {
    var _a;
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var closure = {
        type: utils_1.ClosureType.OneDay,
        start: start.toFormat(utils_1.OVERRIDE_DATE_FORMAT),
        end: start.toFormat(utils_1.OVERRIDE_DATE_FORMAT),
    };
    console.log('closure: ', closure);
    return __assign(__assign({}, scheduleExtCopy), { closures: __spreadArray(__spreadArray([], ((_a = scheduleExtCopy.closures) !== null && _a !== void 0 ? _a : []), true), [closure], false) });
};
exports.addClosureDay = addClosureDay;
var addOverrides = function (scheduleExt, overrides) {
    var overridesToAdd = {};
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    overrides.forEach(function (override) {
        var _a;
        var dateString = override.date.startOf('day').toFormat(utils_1.OVERRIDE_DATE_FORMAT);
        var granularCapacityOverride = (_a = override.granularCapacityOverride) !== null && _a !== void 0 ? _a : [];
        overridesToAdd[dateString] = {
            open: override.open,
            close: override.close,
            openingBuffer: override.openingBuffer,
            closingBuffer: override.closingBuffer,
            hours: Array.from({ length: 24 }, function (_, i) {
                var _a;
                var capacity = 0;
                if (i >= override.open && i < override.close) {
                    var granularOverride = granularCapacityOverride.find(function (g) { return g.hour === i; });
                    capacity = (_a = granularOverride === null || granularOverride === void 0 ? void 0 : granularOverride.capacity) !== null && _a !== void 0 ? _a : override.hourlyCapacity;
                }
                return { hour: i, capacity: capacity };
            }),
        };
    });
    return __assign(__assign({}, scheduleExtCopy), { scheduleOverrides: __assign(__assign({}, (scheduleExtCopy.scheduleOverrides || {})), overridesToAdd) });
};
exports.addOverrides = addOverrides;
var adjustHoursOfOperation = function (scheduleExt, hoursOfOp) {
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var schedule = scheduleExtCopy.schedule;
    var updatedEntries = Object.entries(schedule).map(function (_a) {
        var day = _a[0], daySchedule = _a[1];
        var hoursToSet = hoursOfOp.find(function (hours) { return hours.dayOfWeek === day; });
        if (hoursToSet) {
            var open_1 = hoursToSet.open, close_1 = hoursToSet.close, workingDay = hoursToSet.workingDay;
            return [
                day,
                __assign(__assign({}, daySchedule), { open: open_1, close: close_1, workingDay: workingDay }),
            ];
        }
        return [day, daySchedule];
    });
    var scheduleNew = Object.fromEntries(updatedEntries);
    return __assign(__assign({}, scheduleExtCopy), { schedule: scheduleNew });
};
exports.adjustHoursOfOperation = adjustHoursOfOperation;
var setClosingHourForAllDays = function (scheduleExt, closingHour) {
    var scheduleExtCopy = lodash_1.default.cloneDeep(scheduleExt);
    var schedule = scheduleExtCopy.schedule;
    var newHours = Object.fromEntries(Object.entries(schedule).map(function (_a) {
        var day = _a[0], daySchedule = _a[1];
        var newDaySchedule = __assign({}, daySchedule);
        newDaySchedule.close = closingHour;
        return [day, newDaySchedule];
    }));
    scheduleExtCopy.schedule = newHours;
    return scheduleExtCopy;
};
exports.setClosingHourForAllDays = setClosingHourForAllDays;
var persistSchedule = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleExtension, processId, scheduleOwner, makeOwnerRequest, resource, results, schedule_1, owner, schedule;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                scheduleExtension = input.scheduleExtension, processId = input.processId, scheduleOwner = input.scheduleOwner;
                if (processId === null) {
                    throw new Error('processId is null');
                }
                if (scheduleOwner) {
                    makeOwnerRequest = {
                        method: 'POST',
                        url: scheduleOwner.resourceType,
                        resource: scheduleOwner,
                        fullUrl: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
                    };
                }
                resource = __assign(__assign({}, (0, exports.makeSchedule)({
                    processId: processId,
                    scheduleObject: scheduleExtension,
                    locationRef: makeOwnerRequest ? makeOwnerRequest.fullUrl : undefined,
                })), { id: undefined });
                if (!makeOwnerRequest) return [3 /*break*/, 2];
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [
                            makeOwnerRequest,
                            {
                                method: 'POST',
                                url: 'Schedule',
                                resource: resource,
                            },
                        ],
                    })];
            case 1:
                results = _e.sent();
                schedule_1 = (_b = (_a = results.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Schedule'; })) === null || _b === void 0 ? void 0 : _b.resource;
                owner = (_d = (_c = results.entry) === null || _c === void 0 ? void 0 : _c.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === (scheduleOwner === null || scheduleOwner === void 0 ? void 0 : scheduleOwner.resourceType); })) === null || _d === void 0 ? void 0 : _d.resource;
                return [2 /*return*/, { schedule: schedule_1, owner: owner }];
            case 2: return [4 /*yield*/, oystehr.fhir.create(resource)];
            case 3:
                schedule = _e.sent();
                return [2 /*return*/, { schedule: schedule, owner: undefined }];
        }
    });
}); };
exports.persistSchedule = persistSchedule;
var getScheduleDay = function (scheduleExt, day) {
    var weekday = day.toFormat('cccc').toLowerCase();
    console.log('weekday', weekday);
    var scheduleDay = scheduleExt.schedule[weekday];
    console.log('scheduleDay', scheduleDay);
    return scheduleDay;
};
exports.getScheduleDay = getScheduleDay;
var cleanupTestScheduleResources = function (processId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var schedulesAndSuch, patientsAndThings, deleteRequests, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!oystehr || !processId) {
                    throw new Error('oystehr or processId is null! could not clean up!');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Schedule',
                        params: [
                            {
                                name: '_tag',
                                value: (0, exports.tagForProcessId)(processId),
                            },
                            {
                                name: '_include',
                                value: 'Schedule:actor',
                            },
                            {
                                name: '_revinclude',
                                value: 'Slot:schedule',
                            },
                        ],
                    })];
            case 1:
                schedulesAndSuch = (_a.sent()).unbundle();
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Patient',
                        params: [
                            {
                                name: '_tag',
                                value: (0, exports.tagForProcessId)(processId),
                            },
                            {
                                name: '_revinclude',
                                value: 'RelatedPerson:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Person:link:RelatedPerson',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Person:patient',
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'QuestionnaireResponse:encounter',
                            },
                        ],
                    })];
            case 2:
                patientsAndThings = (_a.sent()).unbundle();
                deleteRequests = __spreadArray(__spreadArray([], schedulesAndSuch, true), patientsAndThings, true).map(function (res) {
                    return {
                        method: 'DELETE',
                        url: "".concat(res.resourceType, "/").concat(res.id),
                    };
                });
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, oystehr.fhir.batch({ requests: deleteRequests })];
            case 4:
                _a.sent();
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error('Error deleting schedules', error_1);
                console.log("ProcessId ".concat(processId, " may need manual cleanup"));
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.cleanupTestScheduleResources = cleanupTestScheduleResources;
var makeTestPatient = function (partial) {
    var base = partial !== null && partial !== void 0 ? partial : {};
    var patient = __assign({ name: [
            {
                use: 'official',
                given: ['Olha'],
                family: 'Test0418',
            },
        ], active: true, gender: 'female', address: [
            {
                city: 'Pembroke Pine',
                line: ['street address new'],
                state: 'CA',
                country: 'US',
                postalCode: '06001',
            },
        ], contact: [
            {
                telecom: [
                    {
                        value: '+12027139680',
                        system: 'phone',
                        extension: [
                            {
                                url: 'https://extensions.fhir.oystehr.com/contact-point/telecom-phone-erx',
                                valueString: 'erx',
                            },
                        ],
                    },
                ],
            },
        ], telecom: [
            {
                value: 'okovalenko+testnew@masslight.com',
                system: 'email',
            },
            {
                value: '+12027139680',
                system: 'phone',
            },
        ], birthDate: '2005-07-18', extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
                valueCodeableConcept: {
                    coding: [
                        {
                            code: '2135-2',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
                            display: 'Hispanic or Latino',
                        },
                    ],
                },
            },
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
                valueCodeableConcept: {
                    coding: [
                        {
                            code: '1002-5',
                            system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
                            display: 'American Indian or Alaska Native',
                        },
                    ],
                },
            },
        ], resourceType: 'Patient', communication: [
            {
                language: {
                    coding: [
                        {
                            code: 'en',
                            system: 'urn:ietf:bcp:47',
                            display: 'English',
                        },
                    ],
                },
                preferred: true,
            },
        ] }, base);
    return patient;
};
exports.makeTestPatient = makeTestPatient;
var persistTestPatient = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patient, processId, resource, createdPatient, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patient = input.patient, processId = input.processId;
                resource = __assign(__assign({}, patient), { id: undefined, meta: {
                        tag: [
                            {
                                system: 'OTTEHR_AUTOMATED_TEST',
                                code: (0, exports.tagForProcessId)(processId),
                                display: 'a test resource that should be cleaned up',
                            },
                        ],
                    } });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, oystehr.fhir.create(resource)];
            case 2:
                createdPatient = _a.sent();
                console.log('createdPatient', createdPatient);
                return [4 /*yield*/, oystehr.fhir.create({
                        resourceType: 'RelatedPerson',
                        patient: { reference: "Patient/".concat(createdPatient.id) },
                        name: [
                            {
                                family: 'Horseman',
                                // cSpell:disable-next Bojack
                                given: ['Bojack'],
                            },
                        ],
                        telecom: [
                            {
                                system: 'phone',
                                value: '+12027139680',
                                use: 'mobile',
                            },
                        ],
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/, createdPatient];
            case 4:
                error_2 = _a.sent();
                console.error('Error creating test patient', error_2);
                throw new Error("Error creating test patient: ".concat(error_2));
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.persistTestPatient = persistTestPatient;
