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
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
function validateRequestParameters(input) {
    var _a;
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var medicationRequest = JSON.parse(input.body);
    if (medicationRequest.resourceType !== 'MedicationRequest') {
        throw new Error("resource parsed should be a medication request but was a ".concat(medicationRequest.resourceType));
    }
    if (!((_a = medicationRequest.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === 'https://identifiers.fhir.oystehr.com/erx-prescription-id'; }))) {
        throw new Error('MedicationRequest does not have an erx prescription id');
    }
    return {
        medicationRequest: medicationRequest,
        secrets: input.secrets,
    };
}
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'process-erx-resources';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, medicationRequest, secrets, oystehr, encounterReference, encounterId, patientReference, patientId, practitionerReference, practitionerId, medData, error_1, ENVIRONMENT;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                _o.trys.push([0, 3, , 4]);
                console.group('validateRequestParameters');
                _a = validateRequestParameters(input), medicationRequest = _a.medicationRequest, secrets = _a.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _o.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('Created zapToken and fhir client');
                console.log("Medication request id: ".concat(medicationRequest.id));
                encounterReference = (_b = medicationRequest.encounter) === null || _b === void 0 ? void 0 : _b.reference;
                encounterId = encounterReference === null || encounterReference === void 0 ? void 0 : encounterReference.split('/')[1];
                patientReference = (_c = medicationRequest.subject) === null || _c === void 0 ? void 0 : _c.reference;
                patientId = patientReference === null || patientReference === void 0 ? void 0 : patientReference.split('/')[1];
                practitionerReference = (_d = medicationRequest.requester) === null || _d === void 0 ? void 0 : _d.reference;
                practitionerId = practitionerReference === null || practitionerReference === void 0 ? void 0 : practitionerReference.split('/')[1];
                console.log("Encounter ref: ".concat(encounterReference));
                console.log("Patient ref: ".concat(patientReference));
                medData = (_f = (_e = medicationRequest.medicationCodeableConcept) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f.find(function (coding) { return coding.system === utils_1.MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM; });
                console.log('Patching MedicationRequest and create MedicationStatement');
                return [4 /*yield*/, Promise.all([
                        oystehr.fhir.patch({
                            resourceType: medicationRequest.resourceType,
                            id: medicationRequest.id,
                            operations: [
                                {
                                    op: 'add',
                                    path: '/meta',
                                    value: (0, shared_1.fillMeta)(utils_1.ERX_MEDICATION_META_TAG_CODE, utils_1.ERX_MEDICATION_META_TAG_CODE),
                                },
                            ],
                        }),
                        encounterId &&
                            patientId &&
                            practitionerId &&
                            oystehr.fhir.create((0, shared_1.makeMedicationResource)(encounterId, patientId, practitionerId, {
                                status: 'active',
                                name: (medData === null || medData === void 0 ? void 0 : medData.display) || '',
                                id: medData === null || medData === void 0 ? void 0 : medData.code,
                                intakeInfo: {
                                    dose: ((_h = (_g = medicationRequest.dispenseRequest) === null || _g === void 0 ? void 0 : _g.quantity) === null || _h === void 0 ? void 0 : _h.value)
                                        ? "".concat((_k = (_j = medicationRequest.dispenseRequest) === null || _j === void 0 ? void 0 : _j.quantity) === null || _k === void 0 ? void 0 : _k.value).concat(' ' + ((_m = (_l = medicationRequest.dispenseRequest) === null || _l === void 0 ? void 0 : _l.quantity) === null || _m === void 0 ? void 0 : _m.unit) || '')
                                        : undefined,
                                },
                                type: 'scheduled',
                            }, 'prescribed-medication')),
                    ])];
            case 2:
                _o.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: "Successfully processed erx MedicationRequest ".concat(medicationRequest.id),
                    }];
            case 3:
                error_1 = _o.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('Process ERX MedicationRequest error', error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
