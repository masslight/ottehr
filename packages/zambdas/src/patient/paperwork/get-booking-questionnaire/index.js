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
var auth_1 = require("../../../shared/auth");
var ZAMBDA_NAME = 'get-booking-questionnaire';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, validatedParams, secrets, oystehr, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                validatedParameters = validateRequestParameters(input);
                validatedParams = validatedParameters;
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParams.secrets;
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _a.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParams, oystehr)];
            case 4:
                effectInput = _a.sent();
                console.time('perform-effect');
                return [4 /*yield*/, performEffect(effectInput)];
            case 5:
                response = _a.sent();
                console.timeEnd('perform-effect');
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var patient, questionnaire, serviceCategoryCode, serviceMode, items, valueSets, allItems, prepopulatedItem, questionnaireResponse;
    return __generator(this, function (_a) {
        patient = input.patient, questionnaire = input.questionnaire, serviceCategoryCode = input.serviceCategoryCode, serviceMode = input.serviceMode;
        items = questionnaire.item || [];
        valueSets = [];
        allItems = (0, utils_1.mapQuestionnaireAndValueSetsToItemsList)(items, valueSets);
        prepopulatedItem = (0, utils_1.prepopulateBookingForm)({
            questionnaire: questionnaire,
            context: {
                serviceMode: serviceMode,
                serviceCategoryCode: serviceCategoryCode,
            },
            patient: patient,
        });
        console.log('prepopulatedItem', JSON.stringify(prepopulatedItem, null, 2));
        questionnaireResponse = {
            resourceType: 'QuestionnaireResponse',
            questionnaire: "".concat(questionnaire.url, "|").concat(questionnaire.version),
            status: 'in-progress',
            subject: patient ? { reference: "Patient/".concat(patient.id) } : undefined,
            item: prepopulatedItem,
        };
        if (patient) {
            console.log('todo: prefill a QR for the patient');
        }
        return [2 /*return*/, {
                allItems: allItems,
                questionnaireResponse: questionnaireResponse,
                title: questionnaire.title,
            }];
    });
}); };
var Access_Level;
(function (Access_Level) {
    Access_Level[Access_Level["anonymous"] = 0] = "anonymous";
    Access_Level[Access_Level["full"] = 1] = "full";
})(Access_Level || (Access_Level = {}));
var validateUserAccess = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, user, appointmentPatient, hasAccess;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                oystehr = input.oystehr, user = input.user, appointmentPatient = input.appointmentPatient;
                if (!(user && appointmentPatient.id)) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, auth_1.userHasAccessToPatient)(user, appointmentPatient.id, oystehr)];
            case 1:
                hasAccess = _a.sent();
                if (hasAccess) {
                    return [2 /*return*/, Access_Level.full];
                }
                else {
                    return [2 /*return*/, Access_Level.anonymous];
                }
                _a.label = 2;
            case 2: return [2 /*return*/, Access_Level.anonymous];
        }
    });
}); };
var validateRequestParameters = function (input) {
    var _a, _b;
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var parsed;
    try {
        parsed = utils_1.GetBookingQuestionnaireParamsSchema.parse(JSON.parse(input.body));
    }
    catch (e) {
        throw (0, utils_1.INVALID_INPUT_ERROR)(e.message);
    }
    var authorization = (_a = input.headers.Authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
    return __assign(__assign({}, parsed), { secrets: (_b = input.secrets) !== null && _b !== void 0 ? _b : null, userToken: authorization !== null && authorization !== void 0 ? authorization : null });
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, slotId, userToken, secrets, slot, serviceMode, serviceCategoryCode, templateQuestionnaire, patient, user, accessLevel;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                patientId = input.patientId, slotId = input.slotId, userToken = input.userToken, secrets = input.secrets;
                return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Slot', id: slotId })];
            case 1:
                slot = _b.sent();
                if (!slot) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Slot');
                }
                serviceMode = (0, utils_1.getServiceModeFromSlot)(slot);
                serviceCategoryCode = (_a = (0, utils_1.getServiceCategoryFromSlot)(slot)) !== null && _a !== void 0 ? _a : utils_1.BOOKING_CONFIG.serviceCategories[0].code;
                if (!serviceMode) {
                    // this indicates something is misconfigured in the slot or schedule
                    throw new Error('Could not determine service mode from slot');
                }
                templateQuestionnaire = (0, utils_1.selectBookingQuestionnaire)(slot).templateQuestionnaire;
                if (!templateQuestionnaire) {
                    throw (0, utils_1.INVALID_INPUT_ERROR)('A canonical URL could not be resolved from the provided slotId. Check system configuration.');
                }
                if (!patientId) return [3 /*break*/, 3];
                return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Patient', id: patientId })];
            case 2:
                patient = _b.sent();
                _b.label = 3;
            case 3:
                if (!userToken) {
                    patient = undefined;
                }
                if (!(userToken && patient)) return [3 /*break*/, 6];
                console.log('getting user');
                return [4 /*yield*/, (0, auth_1.getUser)(userToken, secrets)];
            case 4:
                user = _b.sent();
                return [4 /*yield*/, validateUserAccess({
                        oystehr: oystehr,
                        user: user,
                        appointmentPatient: patient,
                    })];
            case 5:
                accessLevel = _b.sent();
                if (accessLevel === Access_Level.anonymous) {
                    patient = undefined;
                }
                _b.label = 6;
            case 6: return [2 /*return*/, {
                    serviceCategoryCode: serviceCategoryCode,
                    serviceMode: serviceMode,
                    patient: patient,
                    questionnaire: templateQuestionnaire,
                }];
        }
    });
}); };
