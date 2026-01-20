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
exports.IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL = exports.IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL = exports.CONTAINED_EMERGENCY_CONTACT_ID = exports.CONTAINED_MEDICATION_ID = void 0;
exports.updateOrderDetails = updateOrderDetails;
exports.validateOrderDetails = validateOrderDetails;
exports.getContainedMedication = getContainedMedication;
var utils_1 = require("utils");
var systemUrls_1 = require("utils/lib/fhir/systemUrls");
var helpers_1 = require("../create-update-medication-order/helpers");
exports.CONTAINED_MEDICATION_ID = 'medication';
exports.CONTAINED_EMERGENCY_CONTACT_ID = 'emergencyContact';
exports.IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL = (0, systemUrls_1.ottehrExtensionUrl)('immunization-order-created-date-time');
exports.IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL = (0, systemUrls_1.ottehrExtensionUrl)('immunization-order-medication-id');
function updateOrderDetails(medicationAdministration, orderDetails, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var medication, dose, units, orderedProvider, route, location, instructions, containedMedication, currentMedicationId, medicationResource, medicationLocalCopy, routeCoding, locationCoding, orderedProviderResource;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    medication = orderDetails.medication, dose = orderDetails.dose, units = orderDetails.units, orderedProvider = orderDetails.orderedProvider, route = orderDetails.route, location = orderDetails.location, instructions = orderDetails.instructions;
                    containedMedication = getContainedMedication(medicationAdministration);
                    currentMedicationId = (_b = (_a = containedMedication === null || containedMedication === void 0 ? void 0 : containedMedication.extension) === null || _a === void 0 ? void 0 : _a.find(function (e) { return e.url === exports.IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL; })) === null || _b === void 0 ? void 0 : _b.valueString;
                    if (!(medication.id !== currentMedicationId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Medication',
                            id: medication.id,
                        })];
                case 1:
                    medicationResource = _d.sent();
                    medicationLocalCopy = (0, helpers_1.createMedicationCopy)(medicationResource, {});
                    if (medicationLocalCopy.extension == null) {
                        medicationLocalCopy.extension = [];
                    }
                    medicationLocalCopy.extension.push({
                        url: exports.IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
                        valueString: medication.id,
                    });
                    medicationAdministration.medicationReference = { reference: '#' + exports.CONTAINED_MEDICATION_ID };
                    medicationAdministration.contained = [
                        __assign(__assign({}, medicationLocalCopy), { id: exports.CONTAINED_MEDICATION_ID }),
                    ];
                    _d.label = 2;
                case 2:
                    routeCoding = route ? (0, utils_1.searchRouteByCode)(route) : undefined;
                    locationCoding = location ? (0, utils_1.searchMedicationLocation)(location.code, location.name) : undefined;
                    medicationAdministration.dosage = {
                        dose: {
                            unit: units,
                            value: parseFloat(dose),
                            system: utils_1.MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
                        },
                        route: routeCoding
                            ? {
                                coding: [
                                    {
                                        code: routeCoding.code,
                                        system: utils_1.MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
                                        display: routeCoding.display,
                                    },
                                ],
                            }
                            : undefined,
                        site: locationCoding
                            ? {
                                coding: [
                                    {
                                        system: locationCoding.system,
                                        code: locationCoding.code,
                                        display: locationCoding.name,
                                    },
                                ],
                            }
                            : undefined,
                        text: instructions,
                    };
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: orderedProvider.id,
                        })];
                case 3:
                    orderedProviderResource = _d.sent();
                    medicationAdministration.performer = __spreadArray(__spreadArray([], ((_c = medicationAdministration.performer) !== null && _c !== void 0 ? _c : []).filter(function (performer) {
                        var _a;
                        return ((_a = (0, utils_1.getCoding)(performer.function, utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)) === null || _a === void 0 ? void 0 : _a.code) !==
                            utils_1.PRACTITIONER_ORDERED_BY_MEDICATION_CODE;
                    }), true), [
                        {
                            actor: {
                                reference: "Practitioner/".concat(orderedProvider.id),
                                display: (0, utils_1.getFullName)(orderedProviderResource),
                            },
                            function: {
                                coding: [
                                    {
                                        system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                                        code: utils_1.PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
                                    },
                                ],
                            },
                        },
                    ], false);
                    return [2 /*return*/];
            }
        });
    });
}
function validateOrderDetails(orderDetails) {
    var medication = orderDetails.medication, dose = orderDetails.dose, units = orderDetails.units, orderedProvider = orderDetails.orderedProvider;
    var missingFields = [];
    if (!(medication === null || medication === void 0 ? void 0 : medication.id))
        missingFields.push('orderDetails.medication.id');
    if (!dose)
        missingFields.push('orderDetails.dose');
    if (!units)
        missingFields.push('orderDetails.units');
    if (!(orderedProvider === null || orderedProvider === void 0 ? void 0 : orderedProvider.id))
        missingFields.push('orderDetails.orderedProvider.id');
    return missingFields;
}
function getContainedMedication(medicationAdministration) {
    var _a;
    return (_a = medicationAdministration.contained) === null || _a === void 0 ? void 0 : _a.find(function (resource) { return resource.id === exports.CONTAINED_MEDICATION_ID; });
}
