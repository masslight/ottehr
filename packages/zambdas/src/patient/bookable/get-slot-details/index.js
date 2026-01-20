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
var utils_1 = require("utils");
var shared_1 = require("../../../ehr/schedules/shared");
var shared_2 = require("../../../shared");
var ZAMBDA_NAME = 'get-slot-details';
var m2mToken;
exports.index = (0, shared_2.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, slotDetails, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_2.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_2.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                slotDetails = performEffect(effectInput);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(slotDetails),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_2.topLevelCatch)('get-slot-details', error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) {
    var _a, _b;
    var slot = input.slot, schedule = input.schedule, scheduleOwner = input.scheduleOwner, appointmentId = input.appointmentId, originalBookingUrl = input.originalBookingUrl;
    var startISO = slot.start;
    var endISO = slot.end;
    var serviceMode = (_a = (0, utils_1.getServiceModeFromSlot)(slot)) !== null && _a !== void 0 ? _a : (0, utils_1.getServiceModeFromScheduleOwner)(scheduleOwner);
    if (!serviceMode) {
        serviceMode = utils_1.ServiceMode['in-person'];
    }
    var ownerType = scheduleOwner.resourceType;
    var ownerId = scheduleOwner.id;
    var isWalkin = (0, utils_1.getSlotIsWalkin)(slot);
    var ownerName = (0, shared_1.getNameForOwner)(scheduleOwner);
    // how to handle timezone is fairly context/use case specific
    // here we're defaulting to the schedule's timezone if it exists, else the schedule owner's timezone
    var timezoneForDisplay = (_b = (0, utils_1.getTimezone)(schedule)) !== null && _b !== void 0 ? _b : (0, utils_1.getTimezone)(scheduleOwner);
    return {
        slotId: slot.id,
        status: slot.status,
        scheduleId: schedule.id,
        startISO: startISO,
        endISO: endISO,
        serviceMode: serviceMode,
        ownerType: ownerType,
        ownerId: ownerId,
        isWalkin: isWalkin,
        appointmentId: appointmentId,
        comment: slot.comment,
        timezoneForDisplay: timezoneForDisplay,
        ownerName: ownerName,
        originalBookingUrl: originalBookingUrl,
    };
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var slotId = JSON.parse(input.body).slotId;
    if (!slotId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['slotId']);
    }
    if ((0, utils_1.isValidUUID)(slotId) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"slotId" must be a valid UUID');
    }
    return {
        secrets: input.secrets,
        slotId: slotId,
    };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var slotId, slotAndChainedResources, slot, schedule, _a, scheduleOwnerType, scheduleOwnerId, scheduleOwner, scheduleOwnerNotFoundError, appointment, originalBookingUrl;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                slotId = input.slotId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Slot',
                        params: [
                            { name: '_id', value: slotId },
                            { name: '_revinclude', value: 'Appointment:slot' },
                            { name: '_include', value: 'Slot:schedule' },
                            { name: '_include:iterate', value: 'Schedule:actor' },
                        ],
                    })];
            case 1:
                slotAndChainedResources = (_e.sent()).unbundle();
                slot = slotAndChainedResources.find(function (s) { return s.resourceType === 'Slot' && s.id === slotId; });
                if (!slot) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Slot');
                }
                schedule = slotAndChainedResources.find(function (s) { var _a; return s.resourceType === 'Schedule' && "Schedule/".concat(s.id) === ((_a = slot.schedule) === null || _a === void 0 ? void 0 : _a.reference); });
                if (!schedule) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Schedule');
                }
                _a = ((_d = (_c = (_b = schedule.actor) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference) !== null && _d !== void 0 ? _d : '').split('/'), scheduleOwnerType = _a[0], scheduleOwnerId = _a[1];
                scheduleOwner = slotAndChainedResources.find(function (s) { return s.resourceType === scheduleOwnerType && s.id === scheduleOwnerId; });
                if (!scheduleOwner) {
                    scheduleOwnerNotFoundError = (0, utils_1.SCHEDULE_NOT_FOUND_CUSTOM_ERROR)("The schedule resource owning this slot, Schedule/".concat(schedule.id, ", could not be connected to any resource referenced by its \"actor\" field. Please ensure that Schedule.actor[0] references an existing Practitioner, Location, or HealthcareService resource."));
                    throw scheduleOwnerNotFoundError;
                }
                appointment = slotAndChainedResources.find(function (s) { return s.resourceType === 'Appointment'; });
                originalBookingUrl = (0, utils_1.getOriginalBookingUrlFromSlot)(slot);
                return [2 /*return*/, {
                        slot: slot,
                        schedule: schedule,
                        scheduleOwner: scheduleOwner,
                        appointmentId: appointment === null || appointment === void 0 ? void 0 : appointment.id,
                        originalBookingUrl: originalBookingUrl,
                    }];
        }
    });
}); };
