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
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var m2mToken;
var ZAMBDA_NAME = 'get-schedule';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, scheduleDTO, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
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
                scheduleDTO = performEffect(effectInput);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(scheduleDTO),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('ehr-get-schedule', error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) {
    var _a, _b;
    var scheduleExtension = input.scheduleExtension, scheduleId = input.scheduleId, timezone = input.timezone, ownerResource = input.owner, scheduleActive = input.scheduleActive;
    var active = false;
    if (ownerResource.resourceType === 'Location') {
        active = ownerResource.status === 'active';
    }
    else {
        active = (_a = ownerResource.active) !== null && _a !== void 0 ? _a : false;
    }
    var detailText = undefined;
    var isVirtual = undefined;
    if (ownerResource.resourceType === 'Location') {
        var loc = ownerResource;
        var address = loc.address;
        if (address) {
            detailText = (0, shared_2.addressStringFromAddress)(address);
        }
        isVirtual = (0, utils_1.isLocationVirtual)(loc);
    }
    var owner = {
        type: ownerResource.resourceType,
        id: ownerResource.id,
        name: (0, shared_2.getNameForOwner)(ownerResource),
        slug: (_b = (0, utils_1.getSlugForBookableResource)(ownerResource)) !== null && _b !== void 0 ? _b : '',
        timezone: (0, utils_1.getTimezone)(ownerResource),
        active: active,
        detailText: detailText,
        infoMessage: '',
        hoursOfOperation: ownerResource === null || ownerResource === void 0 ? void 0 : ownerResource.hoursOfOperation,
        isVirtual: isVirtual,
    };
    return {
        owner: owner,
        id: scheduleId,
        timezone: timezone,
        schema: scheduleExtension,
        bookingLink: '',
        active: scheduleActive,
    };
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), scheduleId = _a.scheduleId, ownerId = _a.ownerId, ownerType = _a.ownerType;
    var createMode = Boolean(ownerId) && Boolean(ownerType);
    if (scheduleId && (ownerId || ownerType)) {
        (0, utils_1.INVALID_INPUT_ERROR)('If scheduleId is provided, ownerId and ownerType must not be provided');
    }
    if (!scheduleId && !ownerId && !ownerType) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['scheduleId']);
    }
    if (ownerId && !ownerType) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['ownerType']);
    }
    if (ownerType && !ownerId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['ownerId']);
    }
    if (scheduleId && (0, utils_1.isValidUUID)(scheduleId) === false && !createMode) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('scheduleId');
    }
    if (ownerId && (0, utils_1.isValidUUID)(ownerId) === false && createMode) {
        console.log('ownerId', ownerId);
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('ownerId');
    }
    if (createMode && !['Location', 'Practitioner', 'HealthcareService'].includes(ownerType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"ownerType" must be a string and one of: "Location", "Practitioner", "HealthcareService"');
    }
    var bi = {
        secrets: secrets,
    };
    if (scheduleId) {
        bi.scheduleId = scheduleId;
    }
    else if (ownerId && ownerType) {
        bi.owner = {
            ownerId: ownerId,
            ownerType: ownerType,
        };
    }
    console.log('bi', JSON.stringify(bi, null, 2));
    return bi;
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleId, owner;
    return __generator(this, function (_a) {
        scheduleId = input.scheduleId, owner = input.owner;
        if (scheduleId) {
            return [2 /*return*/, getEffectInputFromSchedule(scheduleId, oystehr)];
        }
        if (owner) {
            return [2 /*return*/, getEffectInputFromOwner(owner, oystehr)];
        }
        throw new Error('Input validation produced unexpected undefined values');
    });
}); };
var getEffectInputFromSchedule = function (scheduleId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleAndOwner, schedule, scheduleExtension, scheduleOwnerRef, _a, scheduleOwnerType, scheduleOwnerId, owner, permittedScheduleOwnerTypes;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Schedule',
                    params: [
                        {
                            name: '_id',
                            value: scheduleId,
                        },
                        {
                            name: '_include',
                            value: 'Schedule:actor:Location',
                        },
                        {
                            name: '_include',
                            value: 'Schedule:actor:Practitioner',
                        },
                        {
                            name: '_include',
                            value: 'Schedule:actor:HealthcareService',
                        },
                    ],
                })];
            case 1:
                scheduleAndOwner = (_f.sent()).unbundle();
                schedule = scheduleAndOwner.find(function (scheduleToFind) { return scheduleToFind.resourceType === 'Schedule'; });
                if (!schedule || !schedule.id) {
                    throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                }
                scheduleExtension = (0, utils_1.getScheduleExtension)(schedule);
                if (!scheduleExtension) {
                    throw utils_1.MISSING_SCHEDULE_EXTENSION_ERROR;
                }
                scheduleOwnerRef = (_d = (_c = (_b = schedule.actor) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference) !== null && _d !== void 0 ? _d : '';
                _a = scheduleOwnerRef.split('/'), scheduleOwnerType = _a[0], scheduleOwnerId = _a[1];
                owner = undefined;
                permittedScheduleOwnerTypes = ['Location', 'Practitioner', 'HealthcareService'];
                if (scheduleOwnerId !== undefined && permittedScheduleOwnerTypes.includes(scheduleOwnerType)) {
                    owner = scheduleAndOwner.find(function (res) {
                        return "".concat(res.resourceType, "/").concat(res.id) === scheduleOwnerRef;
                    });
                }
                if (!owner) {
                    throw utils_1.SCHEDULE_OWNER_NOT_FOUND_ERROR;
                }
                return [2 /*return*/, {
                        scheduleId: schedule.id,
                        scheduleExtension: scheduleExtension,
                        timezone: (0, utils_1.getTimezone)(schedule),
                        owner: owner,
                        scheduleActive: (_e = schedule.active) !== null && _e !== void 0 ? _e : true,
                    }];
        }
    });
}); };
var getEffectInputFromOwner = function (ownerDef, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var ownerId, ownerType, scheduleAndOwner, scheduleId, scheduleExtension, schedule, scheduleOwnerRef, _a, scheduleOwnerType, scheduleOwnerId, owner, permittedScheduleOwnerTypes;
    var _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                ownerId = ownerDef.ownerId, ownerType = ownerDef.ownerType;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: ownerType,
                        params: [
                            {
                                name: '_id',
                                value: ownerId,
                            },
                            {
                                name: '_revinclude',
                                value: "Schedule:actor:".concat(ownerType),
                            },
                        ],
                    })];
            case 1:
                scheduleAndOwner = (_g.sent()).unbundle();
                scheduleId = 'new-schedule';
                scheduleExtension = utils_1.BLANK_SCHEDULE_JSON_TEMPLATE;
                schedule = scheduleAndOwner.find(function (scheduleToFind) { return scheduleToFind.resourceType === 'Schedule'; });
                if (schedule && schedule.id) {
                    scheduleId = schedule.id;
                    scheduleExtension = (_b = (0, utils_1.getScheduleExtension)(schedule)) !== null && _b !== void 0 ? _b : utils_1.BLANK_SCHEDULE_JSON_TEMPLATE;
                }
                console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
                scheduleOwnerRef = (_e = (_d = (_c = schedule === null || schedule === void 0 ? void 0 : schedule.actor) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.reference) !== null && _e !== void 0 ? _e : '';
                _a = scheduleOwnerRef.split('/'), scheduleOwnerType = _a[0], scheduleOwnerId = _a[1];
                owner = undefined;
                permittedScheduleOwnerTypes = ['Location', 'Practitioner', 'HealthcareService'];
                if (scheduleOwnerId !== undefined && permittedScheduleOwnerTypes.includes(scheduleOwnerType)) {
                    owner = scheduleAndOwner.find(function (res) {
                        return "".concat(res.resourceType, "/").concat(res.id) === scheduleOwnerRef;
                    });
                }
                else {
                    owner = scheduleAndOwner.find(function (res) {
                        return "".concat(res.resourceType, "/").concat(res.id) === "".concat(ownerType, "/").concat(ownerId);
                    });
                }
                if (!owner) {
                    throw utils_1.SCHEDULE_OWNER_NOT_FOUND_ERROR;
                }
                return [2 /*return*/, {
                        scheduleId: scheduleId,
                        scheduleExtension: scheduleExtension,
                        timezone: schedule ? (0, utils_1.getTimezone)(schedule) : utils_1.TIMEZONES[0],
                        owner: owner,
                        scheduleActive: schedule ? (_f = schedule.active) !== null && _f !== void 0 ? _f : true : true,
                    }];
        }
    });
}); };
