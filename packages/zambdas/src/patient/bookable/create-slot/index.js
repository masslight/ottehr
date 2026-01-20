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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ZAMBDA_NAME = 'create-slot';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, slot, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
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
                slot = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(slot),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-slot', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var slot;
    return __generator(this, function (_a) {
        slot = input.slot;
        return [2 /*return*/, oystehr.fhir.create(slot)];
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), scheduleId = _a.scheduleId, startISO = _a.startISO, lengthInMinutes = _a.lengthInMinutes, lengthInHours = _a.lengthInHours, status = _a.status, walkin = _a.walkin, serviceModality = _a.serviceModality, postTelemedLabOnly = _a.postTelemedLabOnly, originalBookingUrl = _a.originalBookingUrl, maybeServiceCategoryCode = _a.serviceCategoryCode;
    // required param checks
    if (!scheduleId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['scheduleId']);
    }
    if (!startISO) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['startISO']);
    }
    if (!serviceModality) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['serviceModality']);
    }
    if ((0, utils_1.isValidUUID)(scheduleId) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"scheduleId" must be a valid UUID');
    }
    if (typeof scheduleId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"scheduleId" must be a string');
    }
    if (typeof startISO !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"startISO" must be a string');
    }
    var startDate = luxon_1.DateTime.fromISO(startISO);
    if (!startDate || startDate.isValid === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"startISO" must be a valid ISO date');
    }
    var now = luxon_1.DateTime.now();
    if (!walkin && startDate < now) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"startISO" must be in the future');
    }
    if (status && typeof status !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"status" must be a string');
    }
    if (status && !['busy', 'free', 'busy-unavailable', 'busy-tentative', 'entered-in-error'].includes(status)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"status" must be one of: "busy", "free", "busy-unavailable", "busy-tentative", "entered-in-error"');
    }
    if (!lengthInMinutes && !lengthInHours) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Either "lengthInMinutes" or "lengthInHours" must be provided and must be greater than 0');
    }
    if (lengthInMinutes && lengthInHours) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Either "lengthInMinutes" or "lengthInHours" must be provided, not both');
    }
    if (lengthInMinutes && typeof lengthInMinutes !== 'number') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"lengthInMinutes" must be a number');
    }
    if (lengthInHours && typeof lengthInHours !== 'number') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"lengthInHours" must be a number');
    }
    if (walkin !== undefined && typeof walkin !== 'boolean') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"walkin" must be a boolean');
    }
    if (postTelemedLabOnly !== undefined && typeof postTelemedLabOnly !== 'boolean') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"postTelemedLabOnly" must be a boolean');
    }
    if (typeof serviceModality !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"serviceModality" must be a string');
    }
    if (!['in-person', 'virtual'].includes(serviceModality)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"serviceModality" must be one of: "in-person", "virtual"');
    }
    if (originalBookingUrl && typeof originalBookingUrl !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('if included, "originalBookingUrl must be a string');
    }
    var apptLength = { length: 0, unit: 'minutes' };
    if (lengthInMinutes) {
        apptLength.length = lengthInMinutes;
        apptLength.unit = 'minutes';
    }
    else {
        apptLength.length = lengthInHours;
        apptLength.unit = 'hours';
    }
    var serviceCategoryCode;
    if (maybeServiceCategoryCode) {
        serviceCategoryCode = utils_1.ServiceCategoryCodeSchema.safeParse(maybeServiceCategoryCode).data;
        if (!serviceCategoryCode) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("\"serviceCategoryCode\" must be one of ".concat(utils_1.ServiceCategoryCodeSchema.options.join(', ')));
        }
    }
    return {
        secrets: input.secrets,
        scheduleId: scheduleId,
        startISO: startISO,
        status: status,
        apptLength: apptLength,
        walkin: walkin !== null && walkin !== void 0 ? walkin : false,
        postTelemedLabOnly: postTelemedLabOnly !== null && postTelemedLabOnly !== void 0 ? postTelemedLabOnly : false,
        serviceModality: serviceModality,
        originalBookingUrl: originalBookingUrl,
        serviceCategoryCode: serviceCategoryCode,
    };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleId, startISO, apptLength, status, walkin, serviceModality, postTelemedLabOnly, originalBookingUrl, serviceCategoryCode, schedule, timezone, startTime, endTime, start, end, serviceCategory, serviceCategoryCodeCoding, extension, slot;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                scheduleId = input.scheduleId, startISO = input.startISO, apptLength = input.apptLength, status = input.status, walkin = input.walkin, serviceModality = input.serviceModality, postTelemedLabOnly = input.postTelemedLabOnly, originalBookingUrl = input.originalBookingUrl, serviceCategoryCode = input.serviceCategoryCode;
                return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Schedule', id: scheduleId })];
            case 1:
                schedule = _b.sent();
                if (!schedule) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Schedule');
                }
                timezone = (0, utils_1.getTimezone)(schedule);
                startTime = luxon_1.DateTime.fromISO(startISO);
                endTime = startTime.plus((_a = {}, _a[apptLength.unit] = apptLength.length, _a));
                start = startTime.setZone(timezone).toISO();
                end = endTime.setZone(timezone).toISO();
                if (!start || !end) {
                    throw (0, utils_1.INVALID_INPUT_ERROR)('Unable to create start and end times');
                }
                serviceCategory = serviceModality === utils_1.ServiceMode['in-person']
                    ? [utils_1.SlotServiceCategory.inPersonServiceMode]
                    : [utils_1.SlotServiceCategory.virtualServiceMode];
                if (serviceCategoryCode) {
                    serviceCategoryCodeCoding = utils_1.BOOKING_CONFIG.serviceCategories.find(function (sc) { return sc.code === serviceCategoryCode; });
                    if (serviceCategoryCodeCoding) {
                        serviceCategory.push({
                            coding: [
                                __assign({}, serviceCategoryCodeCoding),
                            ],
                        });
                    }
                }
                if (originalBookingUrl) {
                    extension = [(0, utils_1.makeBookingOriginExtensionEntry)(originalBookingUrl)];
                }
                slot = {
                    resourceType: 'Slot',
                    status: status !== null && status !== void 0 ? status : 'busy',
                    start: start,
                    end: end,
                    serviceCategory: serviceCategory,
                    schedule: {
                        reference: "Schedule/".concat(schedule.id),
                    },
                    extension: extension,
                };
                if (walkin) {
                    slot.appointmentType = __assign({}, utils_1.SLOT_WALKIN_APPOINTMENT_TYPE_CODING);
                }
                else if (postTelemedLabOnly) {
                    slot.appointmentType = __assign({}, utils_1.SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING);
                }
                // optional: check if the schedule owner permits the provided service modality
                // we do this instead at appointment creation time
                return [2 /*return*/, { slot: slot }];
        }
    });
}); };
