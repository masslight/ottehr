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
exports.getNextOpeningDateTime = getNextOpeningDateTime;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('get-schedule', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, scheduleType, slug, selectedDate, oystehr, telemedAvailable, availableSlots, scheduleData, scheduleList, metadata, scheduleOwner_1, serviceCategoryCode_1, serviceCategory, serviceCategories, _a, tmSlots, regularSlots, now, DISPLAY_TOMORROW_SLOTS_AT_HOUR, scheduleMatch, locationInformationWithClosures, waitingMinutes, timezone, schedule, response, error_1, ENVIRONMENT;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('this should get logged out if the zambda has been deployed');
                console.log("Input: ".concat(JSON.stringify(input)));
                _c.label = 1;
            case 1:
                _c.trys.push([1, 8, , 9]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets, scheduleType = validatedParameters.scheduleType, slug = validatedParameters.slug, selectedDate = validatedParameters.selectedDate;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 3];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                oystehrToken = _c.sent();
                return [3 /*break*/, 4];
            case 3:
                console.log('already have token', oystehrToken);
                _c.label = 4;
            case 4:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                if (!oystehr) {
                    throw new Error('error initializing fhir client');
                }
                telemedAvailable = [];
                availableSlots = [];
                console.time('get-schedule-from-slug');
                return [4 /*yield*/, (0, shared_1.getSchedules)(oystehr, scheduleType, slug)];
            case 5:
                scheduleData = _c.sent();
                scheduleList = scheduleData.scheduleList, metadata = scheduleData.metadata, scheduleOwner_1 = scheduleData.rootScheduleOwner;
                console.timeEnd('get-schedule-from-slug');
                console.log('groupItems retrieved from getScheduleUtil:', JSON.stringify(scheduleList, null, 2));
                //console.log('owner retrieved from getScheduleUtil:', JSON.stringify(scheduleOwner, null, 2));
                console.log('scheduleMetaData', JSON.stringify(metadata, null, 2));
                serviceCategoryCode_1 = validatedParameters.serviceCategoryCode;
                serviceCategory = utils_1.BOOKING_CONFIG.serviceCategories.find(function (sc) { return sc.code === serviceCategoryCode_1; });
                serviceCategories = serviceCategory
                    ? [
                        {
                            system: serviceCategory.system,
                            code: serviceCategory.code,
                        },
                    ]
                    : undefined;
                console.log('SERVICE CATEGORIES FOR SLOT GENERATION:', JSON.stringify(serviceCategories, null, 2));
                console.time('synchronous_data_processing');
                return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                        now: selectedDate ? luxon_1.DateTime.fromISO(selectedDate).startOf('day') : luxon_1.DateTime.now(),
                        scheduleList: scheduleList,
                        numDays: selectedDate ? 1 : undefined,
                        selectedDate: selectedDate,
                        serviceCategories: serviceCategories,
                    }, oystehr)];
            case 6:
                _a = _c.sent(), tmSlots = _a.telemedAvailable, regularSlots = _a.availableSlots;
                if (scheduleOwner_1.resourceType === 'Location' && !(0, utils_1.isLocationVirtual)(scheduleOwner_1)) {
                    telemedAvailable.push.apply(telemedAvailable, tmSlots);
                }
                availableSlots.push.apply(availableSlots, regularSlots);
                console.timeEnd('synchronous_data_processing');
                if (!scheduleOwner_1) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)((0, utils_1.fhirTypeForScheduleType)(scheduleType));
                }
                now = luxon_1.DateTime.now();
                DISPLAY_TOMORROW_SLOTS_AT_HOUR = parseInt((0, utils_1.getSecret)(utils_1.SecretsKeys.IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR, secrets));
                /*
                todo when Zap supports the near param
                const nearbyLocations: Location = [];
            
                const latitude = location.position?.latitude;
                const longitude = location.position?.longitude;
                if (latitude && longitude && location.id) {
                  console.log('searching for locations near', latitude, longitude);
                  const nearbyLocationSearchResults: Location[] = await oystehr.searchResources({
                    resourceType: 'Location',
                    searchParams: [
                      { name: 'near', value: `${latitude}|${longitude}|20.0|mi_us` },
                      // { name: '_id:not-in', value: location.id },
                    ],
                  });
                  console.log('nearbyLocationSearchResults', nearbyLocationSearchResults.length);
                }*/
                console.log('organizing location information for response');
                scheduleMatch = (_b = scheduleList.find(function (scheduleAndOwner) {
                    var owner = scheduleAndOwner.owner;
                    return owner && "".concat(owner.resourceType, "/").concat(owner.id) === "".concat(scheduleOwner_1.resourceType, "/").concat(scheduleOwner_1.id);
                })) === null || _b === void 0 ? void 0 : _b.schedule;
                locationInformationWithClosures = (0, utils_1.getLocationInformation)(scheduleOwner_1, scheduleMatch);
                console.log('getting wait time based on longest waiting patient at location');
                console.time('get_waiting_minutes');
                return [4 /*yield*/, (0, utils_1.getWaitingMinutesAtSchedule)(oystehr, now, scheduleOwner_1)];
            case 7:
                waitingMinutes = _c.sent();
                console.timeEnd('get_waiting_minutes');
                timezone = void 0;
                if (scheduleList.length === 1) {
                    schedule = scheduleList[0].schedule;
                    if (schedule) {
                        timezone = (0, utils_1.getTimezone)(schedule);
                    }
                }
                response = {
                    message: 'Successfully retrieved all available slot times',
                    available: availableSlots,
                    telemedAvailable: telemedAvailable,
                    location: locationInformationWithClosures,
                    displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
                    waitingMinutes: waitingMinutes,
                    timezone: timezone,
                };
                console.log('response to return: ', response);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _c.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-schedule', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
function getNextOpeningDateTime(now, schedule) {
    var NUM_DAYS_TO_CHECK = 30;
    var day = 0;
    var nextOpeningTime;
    var scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
    if (!scheduleExtension) {
        return undefined;
    }
    var timezone = (0, utils_1.getTimezone)(schedule);
    while (day < NUM_DAYS_TO_CHECK && nextOpeningTime === undefined) {
        var nextOpeningDate = now.plus({ day: day });
        if ((0, utils_1.isLocationOpen)(scheduleExtension, timezone, nextOpeningDate)) {
            var maybeNextOpeningTime = (0, utils_1.getOpeningTime)(scheduleExtension, timezone, nextOpeningDate);
            if (maybeNextOpeningTime && maybeNextOpeningTime > now) {
                nextOpeningTime = maybeNextOpeningTime;
            }
        }
        day++;
    }
    return nextOpeningTime === null || nextOpeningTime === void 0 ? void 0 : nextOpeningTime.setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
}
