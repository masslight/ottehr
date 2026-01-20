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
exports.getImmunizationOrders = getImmunizationOrders;
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var common_1 = require("../common");
var m2mToken;
var ZAMBDA_NAME = 'get-immunization-orders';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = validateRequestParameters(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                return [4 /*yield*/, getImmunizationOrders(oystehr, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
function getImmunizationOrders(oystehr, input) {
    return __awaiter(this, void 0, void 0, function () {
        var orderId, patientId, encounterId, params;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    orderId = input.orderId, patientId = input.patientId, encounterId = input.encounterId;
                    params = [
                        {
                            name: '_tag',
                            value: 'immunization',
                        },
                    ];
                    if (orderId) {
                        params.push({
                            name: '_id',
                            value: orderId,
                        });
                    }
                    if (patientId) {
                        params.push({
                            name: 'subject',
                            value: 'Patient/' + patientId,
                        });
                    }
                    if (encounterId) {
                        params.push({
                            name: 'context',
                            value: 'Encounter/' + encounterId,
                        });
                    }
                    _a = {};
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'MedicationAdministration',
                            params: params,
                        })];
                case 1: return [2 /*return*/, (_a.orders = (_b.sent())
                        .unbundle()
                        .map(mapMedicationAdministrationToImmunizationOrder),
                        _a)];
            }
        });
    });
}
function validateRequestParameters(input) {
    var _a = (0, shared_1.validateJsonBody)(input), orderId = _a.orderId, patientId = _a.patientId, encounterId = _a.encounterId;
    if (!orderId && !patientId && !encounterId) {
        throw new Error("orderId or patientId or encounterId must be provided");
    }
    return {
        orderId: orderId,
        patientId: patientId,
        encounterId: encounterId,
        secrets: input.secrets,
    };
}
function mapMedicationAdministrationToImmunizationOrder(medicationAdministration) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19;
    var status = (_a = (0, utils_1.mapFhirToOrderStatus)(medicationAdministration)) !== null && _a !== void 0 ? _a : '';
    var isAdministered = ['administered', 'administered-partly', 'administered-not'].includes(status);
    var medication = (0, common_1.getContainedMedication)(medicationAdministration);
    var administrationCodesExtensions = ((_b = medicationAdministration.extension) !== null && _b !== void 0 ? _b : []).filter(function (extension) { return extension.url === utils_1.VACCINE_ADMINISTRATION_CODES_EXTENSION_URL; });
    var emergencyContactRelatedPerson = (_c = medicationAdministration.contained) === null || _c === void 0 ? void 0 : _c.find(function (resource) { return resource.id === common_1.CONTAINED_EMERGENCY_CONTACT_ID; });
    var locationCoding = (0, utils_1.getCoding)((_d = medicationAdministration.dosage) === null || _d === void 0 ? void 0 : _d.site, utils_1.MEDICATION_APPLIANCE_LOCATION_SYSTEM);
    return {
        id: medicationAdministration.id,
        status: status,
        reason: (_e = medicationAdministration.note) === null || _e === void 0 ? void 0 : _e[0].text,
        details: {
            medication: {
                id: (_h = (_g = (_f = medication === null || medication === void 0 ? void 0 : medication.extension) === null || _f === void 0 ? void 0 : _f.find(function (e) { return e.url === common_1.IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL; })) === null || _g === void 0 ? void 0 : _g.valueString) !== null && _h !== void 0 ? _h : '',
                name: (_j = (0, utils_1.getMedicationName)(medication)) !== null && _j !== void 0 ? _j : '',
            },
            dose: (_o = (_m = (_l = (_k = medicationAdministration.dosage) === null || _k === void 0 ? void 0 : _k.dose) === null || _l === void 0 ? void 0 : _l.value) === null || _m === void 0 ? void 0 : _m.toString()) !== null && _o !== void 0 ? _o : '',
            units: (_r = (_q = (_p = medicationAdministration.dosage) === null || _p === void 0 ? void 0 : _p.dose) === null || _q === void 0 ? void 0 : _q.unit) !== null && _r !== void 0 ? _r : '',
            orderedProvider: getProvider(medicationAdministration, utils_1.PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
            orderedDateTime: (_u = (_t = (_s = medicationAdministration.extension) === null || _s === void 0 ? void 0 : _s.find(function (e) { return e.url === common_1.IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL; })) === null || _t === void 0 ? void 0 : _t.valueDateTime) !== null && _u !== void 0 ? _u : '',
            route: (_w = (0, utils_1.getCoding)((_v = medicationAdministration.dosage) === null || _v === void 0 ? void 0 : _v.route, utils_1.MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM)) === null || _w === void 0 ? void 0 : _w.code,
            location: locationCoding
                ? {
                    name: (_x = locationCoding.display) !== null && _x !== void 0 ? _x : '',
                    code: (_y = locationCoding.code) !== null && _y !== void 0 ? _y : '',
                }
                : undefined,
            instructions: (_z = medicationAdministration.dosage) === null || _z === void 0 ? void 0 : _z.text,
        },
        administrationDetails: isAdministered && medication
            ? {
                lot: (_1 = (_0 = medication.batch) === null || _0 === void 0 ? void 0 : _0.lotNumber) !== null && _1 !== void 0 ? _1 : '',
                expDate: (_3 = (_2 = medication.batch) === null || _2 === void 0 ? void 0 : _2.expirationDate) !== null && _3 !== void 0 ? _3 : '',
                mvx: (_5 = (_4 = findCoding(administrationCodesExtensions, utils_1.MVX_CODE_SYSTEM_URL)) === null || _4 === void 0 ? void 0 : _4.code) !== null && _5 !== void 0 ? _5 : '',
                cvx: (_7 = (_6 = findCoding(administrationCodesExtensions, utils_1.CVX_CODE_SYSTEM_URL)) === null || _6 === void 0 ? void 0 : _6.code) !== null && _7 !== void 0 ? _7 : '',
                cpt: (_8 = findCoding(administrationCodesExtensions, utils_1.CODE_SYSTEM_CPT)) === null || _8 === void 0 ? void 0 : _8.code,
                ndc: (_10 = (_9 = findCoding(administrationCodesExtensions, utils_1.CODE_SYSTEM_NDC)) === null || _9 === void 0 ? void 0 : _9.code) !== null && _10 !== void 0 ? _10 : '',
                administeredProvider: getProvider(medicationAdministration, utils_1.PRACTITIONER_ADMINISTERED_MEDICATION_CODE),
                administeredDateTime: (_11 = medicationAdministration.effectiveDateTime) !== null && _11 !== void 0 ? _11 : '',
                visGivenDate: (_13 = (_12 = medicationAdministration.extension) === null || _12 === void 0 ? void 0 : _12.find(function (e) { return e.url === utils_1.VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL; })) === null || _13 === void 0 ? void 0 : _13.valueDate,
                emergencyContact: emergencyContactRelatedPerson
                    ? {
                        fullName: (_15 = (_14 = emergencyContactRelatedPerson.name) === null || _14 === void 0 ? void 0 : _14[0].text) !== null && _15 !== void 0 ? _15 : '',
                        mobile: (_17 = (_16 = emergencyContactRelatedPerson.telecom) === null || _16 === void 0 ? void 0 : _16[0].value) !== null && _17 !== void 0 ? _17 : '',
                        relationship: (_19 = (_18 = (0, utils_1.getCoding)(emergencyContactRelatedPerson.relationship, utils_1.VACCINE_ADMINISTRATION_EMERGENCY_CONTACT_RELATIONSHIP_CODE_SYSTEM)) === null || _18 === void 0 ? void 0 : _18.code) !== null && _19 !== void 0 ? _19 : '',
                    }
                    : undefined,
            }
            : undefined,
    };
}
function findCoding(extensions, system) {
    for (var _i = 0, extensions_1 = extensions; _i < extensions_1.length; _i++) {
        var extension = extensions_1[_i];
        var coding = (0, utils_1.getCoding)(extension.valueCodeableConcept, system);
        if (coding) {
            return coding;
        }
    }
    return undefined;
}
function getProvider(medicationAdministration, code) {
    var _a, _b, _c, _d, _e;
    var reference = (_b = (_a = medicationAdministration.performer) === null || _a === void 0 ? void 0 : _a.find(function (performer) { var _a; return ((_a = (0, utils_1.getCoding)(performer.function, utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)) === null || _a === void 0 ? void 0 : _a.code) === code; })) === null || _b === void 0 ? void 0 : _b.actor;
    return {
        id: (_d = (_c = reference === null || reference === void 0 ? void 0 : reference.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1]) !== null && _d !== void 0 ? _d : '',
        name: (_e = reference === null || reference === void 0 ? void 0 : reference.display) !== null && _e !== void 0 ? _e : '',
    };
}
