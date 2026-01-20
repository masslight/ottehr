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
var ZAMBDA_NAME = 'create-schedule';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, updatedSchedule, error_1, ENVIRONMENT;
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
                updatedSchedule = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(updatedSchedule),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-schedule', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var schedule;
    return __generator(this, function (_a) {
        schedule = input.schedule;
        return [2 /*return*/, oystehr.fhir.create(schedule)];
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), ownerId = _a.ownerId, ownerType = _a.ownerType;
    if (!ownerId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['ownerId']);
    }
    if (!ownerType) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['ownerType']);
    }
    if (typeof ownerId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"ownerId" must be a string');
    }
    if (typeof ownerType !== 'string' || !['Location', 'Practitioner', 'HealthcareService'].includes(ownerType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"ownerType" must be a string and one of: "Location", "Practitioner", "HealthcareService"');
    }
    var _b = (0, shared_2.validateUpdateScheduleParameters)(input), secrets = _b.secrets, scheduleId = _b.scheduleId, timezone = _b.timezone, schedule = _b.schedule, scheduleOverrides = _b.scheduleOverrides, closures = _b.closures;
    if (!schedule) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['schedule']);
    }
    return {
        secrets: secrets,
        scheduleId: scheduleId,
        timezone: timezone,
        schedule: schedule,
        scheduleOverrides: scheduleOverrides,
        closures: closures,
        ownerId: ownerId,
        ownerType: ownerType,
    };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var scheduleInput, closures, active, timezone, scheduleOverrides, ownerId, ownerType, owner, scheduleExtension, extension, scheduleJson, schedule;
    return __generator(this, function (_a) {
        scheduleInput = input.schedule, closures = input.closures, active = input.active, timezone = input.timezone, scheduleOverrides = input.scheduleOverrides, ownerId = input.ownerId, ownerType = input.ownerType;
        owner = oystehr.fhir.get({
            resourceType: ownerType,
            id: ownerId,
        });
        if (!owner) {
            throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)(ownerType);
        }
        scheduleExtension = {
            schedule: scheduleInput,
            closures: closures !== null && closures !== void 0 ? closures : [],
            scheduleOverrides: scheduleOverrides !== null && scheduleOverrides !== void 0 ? scheduleOverrides : {},
        };
        extension = [];
        scheduleJson = JSON.stringify(scheduleExtension);
        extension.push({
            url: utils_1.SCHEDULE_EXTENSION_URL,
            valueString: scheduleJson,
        });
        if (timezone) {
            extension.push({
                url: utils_1.TIMEZONE_EXTENSION_URL,
                valueString: timezone,
            });
        }
        schedule = {
            resourceType: 'Schedule',
            active: active !== null && active !== void 0 ? active : true,
            extension: extension,
            actor: [
                {
                    reference: "".concat(ownerType, "/").concat(ownerId),
                },
            ],
        };
        console.log('schedule to write:', JSON.stringify(schedule, null, 2));
        return [2 /*return*/, {
                schedule: schedule,
            }];
    });
}); };
