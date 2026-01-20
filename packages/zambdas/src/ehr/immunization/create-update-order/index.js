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
exports.validateRequestParameters = validateRequestParameters;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var common_1 = require("../common");
var m2mToken;
var ZAMBDA_NAME = 'create-update-immunization-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, userToken, oystehrCurrentUser, userPractitionerId, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                validatedParameters = validateRequestParameters(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                userToken = input.headers.Authorization.replace('Bearer ', '');
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, validatedParameters.secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 2:
                userPractitionerId = _a.sent();
                response = void 0;
                if (!validatedParameters.orderId) return [3 /*break*/, 4];
                return [4 /*yield*/, updateImmunizationOrder(oystehr, validatedParameters)];
            case 3:
                response = _a.sent();
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, createImmunizationOrder(oystehr, validatedParameters, userPractitionerId)];
            case 5:
                response = _a.sent();
                _a.label = 6;
            case 6: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(response),
                }];
            case 7:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 8: return [2 /*return*/];
        }
    });
}); });
function createImmunizationOrder(oystehr, input, userPractitionerId) {
    return __awaiter(this, void 0, void 0, function () {
        var encounterId, details, encounter, medicationAdministration, createdMedicationAdministration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    encounterId = input.encounterId, details = input.details;
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Encounter',
                            id: encounterId,
                        })];
                case 1:
                    encounter = _a.sent();
                    if (!encounter.subject) {
                        throw new Error("Encounter ".concat(encounter.id, " has no subject"));
                    }
                    medicationAdministration = {
                        resourceType: 'MedicationAdministration',
                        subject: encounter.subject,
                        context: (0, utils_1.createReference)(encounter),
                        status: 'in-progress',
                        performer: [
                            {
                                actor: { reference: "Practitioner/".concat(userPractitionerId) },
                                function: {
                                    coding: [
                                        {
                                            system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                                            code: utils_1.PRACTITIONER_ORDERED_MEDICATION_CODE,
                                        },
                                    ],
                                },
                            },
                        ],
                        effectiveDateTime: luxon_1.DateTime.now().toISO(),
                        extension: [
                            {
                                url: common_1.IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL,
                                valueDateTime: luxon_1.DateTime.now().toISO(),
                            },
                        ],
                        meta: (0, shared_1.fillMeta)('immunization', 'immunization'),
                    };
                    return [4 /*yield*/, (0, common_1.updateOrderDetails)(medicationAdministration, details, oystehr)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, oystehr.fhir.create(medicationAdministration)];
                case 3:
                    createdMedicationAdministration = _a.sent();
                    return [2 /*return*/, {
                            orderId: createdMedicationAdministration.id,
                        }];
            }
        });
    });
}
function updateImmunizationOrder(oystehr, input) {
    return __awaiter(this, void 0, void 0, function () {
        var orderId, details, medicationAdministration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orderId = input.orderId, details = input.details;
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'MedicationAdministration',
                            id: orderId,
                        })];
                case 1:
                    medicationAdministration = _a.sent();
                    return [4 /*yield*/, (0, common_1.updateOrderDetails)(medicationAdministration, details, oystehr)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, oystehr.fhir.update(medicationAdministration)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, {
                            orderId: medicationAdministration.id,
                        }];
            }
        });
    });
}
function validateRequestParameters(input) {
    var _a = (0, shared_1.validateJsonBody)(input), orderId = _a.orderId, encounterId = _a.encounterId, details = _a.details;
    var missingFields = [];
    if (!encounterId)
        missingFields.push('encounterId');
    missingFields.push.apply(missingFields, (0, common_1.validateOrderDetails)(details));
    if (missingFields.length > 0)
        throw new Error("Missing required fields [".concat(missingFields.join(', '), "]"));
    return {
        orderId: orderId,
        encounterId: encounterId,
        details: details,
        secrets: input.secrets,
    };
}
