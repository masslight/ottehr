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
exports.getPerformerId = getPerformerId;
exports.createMedicationCopy = createMedicationCopy;
exports.practitionerIdFromZambdaInput = practitionerIdFromZambdaInput;
exports.getMedicationByName = getMedicationByName;
exports.getMedicationById = getMedicationById;
exports.validateProviderAccess = validateProviderAccess;
exports.updateMedicationAdministrationData = updateMedicationAdministrationData;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var fhir_resources_creation_1 = require("./fhir-resources-creation");
function getPerformerId(medicationAdministration) {
    var _a, _b;
    return (_b = (_a = medicationAdministration.performer) === null || _a === void 0 ? void 0 : _a.find(function (perf) { return perf.actor.reference; })) === null || _b === void 0 ? void 0 : _b.actor.reference;
}
function createMedicationCopy(inventoryMedication, orderData, newStatus) {
    var _a, _b, _c;
    var resourceCopy = __assign({}, inventoryMedication);
    delete resourceCopy.id;
    delete resourceCopy.meta;
    // deleting identifier with code that indicates that this medication is inventory one
    var typeIdentifierArrId = (_b = (_a = resourceCopy.identifier) === null || _a === void 0 ? void 0 : _a.findIndex(function (idn) { return idn.value === utils_1.INVENTORY_MEDICATION_TYPE_CODE; })) !== null && _b !== void 0 ? _b : -1;
    if (typeIdentifierArrId >= 0)
        (_c = resourceCopy.identifier) === null || _c === void 0 ? void 0 : _c.splice(typeIdentifierArrId, 1);
    if (newStatus !== utils_1.MedicationOrderStatuses['administered-not'] && (orderData.lotNumber || orderData.expDate)) {
        resourceCopy.batch = {
            lotNumber: orderData.lotNumber,
            expirationDate: orderData.expDate,
        };
    }
    if (orderData.manufacturer)
        resourceCopy.manufacturer = { display: orderData.manufacturer };
    return resourceCopy;
}
function practitionerIdFromZambdaInput(input, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var userToken, oystehr, myPractitionerId, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    userToken = input.headers.Authorization.replace('Bearer ', '');
                    oystehr = (0, shared_1.createOystehrClient)(userToken, secrets);
                    _a = utils_1.removePrefix;
                    _b = ['Practitioner/'];
                    return [4 /*yield*/, oystehr.user.me()];
                case 1:
                    myPractitionerId = _a.apply(void 0, _b.concat([(_c.sent()).profile]));
                    if (!myPractitionerId)
                        throw new Error('No practitioner id was found for token provided');
                    return [2 /*return*/, myPractitionerId];
            }
        });
    });
}
function getMedicationByName(oystehr, medicationName) {
    return __awaiter(this, void 0, void 0, function () {
        var medications, medication;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, ["Medication?identifier=".concat(medicationName)])];
                case 1:
                    medications = _a.sent();
                    medication = medications.find(function (res) { return res.resourceType === 'Medication'; });
                    if (!medication)
                        throw new Error("No medication was found with this name: ".concat(medicationName));
                    return [2 /*return*/, medication];
            }
        });
    });
}
function getMedicationById(oystehr, medicationId) {
    return __awaiter(this, void 0, void 0, function () {
        var medication;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Medication',
                        id: medicationId,
                    })];
                case 1:
                    medication = _a.sent();
                    if (!medication)
                        throw new Error("No medication was found for this id: ".concat(medicationId));
                    return [2 /*return*/, medication];
            }
        });
    });
}
function validateProviderAccess(orderData, newStatus, orderPkg, practitionerId) {
    // some strange logic. On 'MAR' screen only those providers that created order can edit and delete it,
    // but on the 'Medication Details' screen nurses and other stuff can change and move order to another status.
    // So when we receive only new data without status change, it means we are on 'MAR' tab.
    // When we receive new data and new status, it means that we are on 'Medication Details' screen so
    // we don't need provider validation because everybody can do it
    if (orderData && !newStatus && getPerformerId(orderPkg.medicationAdministration) !== practitionerId)
        throw new Error("You can't edit this order, because it was created by another provider");
}
function updateMedicationAdministrationData(data) {
    var orderResources = data.orderResources, orderData = data.orderData, administeredProviderId = data.administeredProviderId, orderedByProviderId = data.orderedByProviderId, medicationResource = data.medicationResource;
    var routeCode = orderData.route
        ? orderData.route
        : (0, utils_1.getDosageUnitsAndRouteOfMedication)(orderResources.medicationAdministration).route;
    var routeCoding = (0, utils_1.searchRouteByCode)(routeCode);
    if (orderData.route && !routeCoding)
        throw new Error("No route found with code provided: ".concat(orderData.route));
    var locationCode = orderData.location
        ? orderData.location
        : (0, utils_1.getLocationCodeFromMedicationAdministration)(orderResources.medicationAdministration);
    var locationCoding = locationCode ? (0, utils_1.searchMedicationLocation)(locationCode) : undefined;
    if (orderData.location && !locationCoding)
        throw new Error("No location found with code provided: ".concat(orderData.location));
    if (!routeCoding)
        throw new Error("No medication appliance route was found for code: ".concat(routeCode));
    var newMA = (0, fhir_resources_creation_1.createMedicationAdministrationResource)({
        orderData: orderData,
        status: orderResources.medicationAdministration.status,
        route: routeCoding,
        location: locationCoding,
        existedMA: orderResources.medicationAdministration,
        administeredProviderId: administeredProviderId,
        orderedByProviderId: orderedByProviderId,
        medicationResource: medicationResource,
    });
    newMA.id = orderResources.medicationAdministration.id;
    return newMA;
}
