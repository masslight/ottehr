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
exports.getMedicationOrders = getMedicationOrders;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-medication-orders';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Created zapToken, fhir and clients.');
                return [4 /*yield*/, getMedicationOrders(oystehr, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log('Error: ', error_1);
                console.log('Stringified error: ', JSON.stringify(error_1));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
function getMedicationOrders(oystehr, validatedParameters) {
    return __awaiter(this, void 0, void 0, function () {
        var orderPackages, allOrders, orders, cancelledOrders;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getOrderPackages(oystehr, validatedParameters.searchBy)];
                case 1:
                    orderPackages = _b.sent();
                    allOrders = (_a = orderPackages === null || orderPackages === void 0 ? void 0 : orderPackages.map(function (pkg) { return mapMedicalAdministrationToDTO(pkg); })) !== null && _a !== void 0 ? _a : [];
                    orders = allOrders.filter(function (med) { return !(0, utils_1.isDeletedMedicationOrder)(med); });
                    cancelledOrders = allOrders.filter(function (med) { return (0, utils_1.isDeletedMedicationOrder)(med); });
                    return [2 /*return*/, {
                            orders: orders,
                            cancelledOrders: cancelledOrders,
                        }];
            }
        });
    });
}
function mapMedicalAdministrationToDTO(orderPackage) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var medicationAdministration = orderPackage.medicationAdministration, providerCreatedOrder = orderPackage.providerCreatedOrder, providerAdministeredOrder = orderPackage.providerAdministeredOrder, medicationRequest = orderPackage.medicationRequest, medicationStatement = orderPackage.medicationStatement;
    var medication = (0, utils_1.getMedicationFromMA)(medicationAdministration);
    var dosageUnitsRoute = (0, utils_1.getDosageUnitsAndRouteOfMedication)(medicationAdministration);
    var orderReasons = (0, utils_1.getReasonAndOtherReasonForNotAdministeredOrder)(medicationAdministration);
    var administeredInfo = (0, utils_1.getProviderIdAndDateMedicationWasAdministered)(medicationAdministration);
    var providerCreatedOrderName = providerCreatedOrder ? (0, utils_1.getFullestAvailableName)(providerCreatedOrder) : '';
    var providerAdministeredOrderName = providerAdministeredOrder && (0, utils_1.getFullestAvailableName)(providerAdministeredOrder);
    var currentOrderedByProviderId = (0, utils_1.getCurrentOrderedByProviderId)(medicationAdministration);
    var providerOrderedBy = orderPackage.providerOrderedBy;
    var providerOrderedByName = providerOrderedBy ? (0, utils_1.getFullestAvailableName)(providerOrderedBy) : '';
    return {
        id: (_a = medicationAdministration.id) !== null && _a !== void 0 ? _a : '',
        status: (_b = (0, utils_1.mapFhirToOrderStatus)(medicationAdministration)) !== null && _b !== void 0 ? _b : 'pending',
        patient: (_d = (_c = medicationAdministration.subject.reference) === null || _c === void 0 ? void 0 : _c.replace('Patient/', '')) !== null && _d !== void 0 ? _d : '',
        encounterId: (_g = (_f = (_e = medicationAdministration.context) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.replace('Encounter/', '')) !== null && _g !== void 0 ? _g : '',
        medicationId: medication === null || medication === void 0 ? void 0 : medication.id,
        medicationName: (_h = (medication && (0, utils_1.getMedicationName)(medication))) !== null && _h !== void 0 ? _h : '',
        dose: (_j = dosageUnitsRoute.dose) !== null && _j !== void 0 ? _j : -1,
        route: (_k = dosageUnitsRoute.route) !== null && _k !== void 0 ? _k : '',
        units: dosageUnitsRoute.units,
        instructions: (_l = medicationAdministration.dosage) === null || _l === void 0 ? void 0 : _l.text,
        reason: orderReasons.reason,
        otherReason: orderReasons.otherReason,
        associatedDx: (_p = (_o = (_m = medicationAdministration.reasonReference) === null || _m === void 0 ? void 0 : _m.find(function (res) { return res.reference; })) === null || _o === void 0 ? void 0 : _o.reference) === null || _p === void 0 ? void 0 : _p.replace('Condition/', ''),
        manufacturer: (_q = medication === null || medication === void 0 ? void 0 : medication.manufacturer) === null || _q === void 0 ? void 0 : _q.display,
        location: (0, utils_1.getLocationCodeFromMedicationAdministration)(medicationAdministration),
        dateTimeCreated: (_r = medicationAdministration.effectiveDateTime) !== null && _r !== void 0 ? _r : '',
        providerCreatedTheOrderId: (0, utils_1.getPractitionerIdThatOrderedMedication)(medicationAdministration) || '',
        providerCreatedTheOrder: providerCreatedOrderName !== null && providerCreatedOrderName !== void 0 ? providerCreatedOrderName : '',
        providerId: currentOrderedByProviderId,
        orderedByProvider: providerOrderedByName,
        // scanning part
        lotNumber: (_s = medication === null || medication === void 0 ? void 0 : medication.batch) === null || _s === void 0 ? void 0 : _s.lotNumber,
        expDate: (_t = medication === null || medication === void 0 ? void 0 : medication.batch) === null || _t === void 0 ? void 0 : _t.expirationDate,
        // administrating
        effectiveDateTime: medicationStatement === null || medicationStatement === void 0 ? void 0 : medicationStatement.effectiveDateTime, // ISO date with timezone
        administeredProviderId: administeredInfo === null || administeredInfo === void 0 ? void 0 : administeredInfo.administeredProviderId,
        administeredProvider: providerAdministeredOrderName,
        interactions: (0, utils_1.getMedicationInteractions)(medicationRequest),
        /**
         * @deprecated Use effectiveDateTime instead. This field is kept for backward compatibility.
         */
        dateGiven: administeredInfo === null || administeredInfo === void 0 ? void 0 : administeredInfo.dateAdministered,
        /**
         * @deprecated Use effectiveDateTime instead. This field is kept for backward compatibility.
         */
        timeGiven: administeredInfo === null || administeredInfo === void 0 ? void 0 : administeredInfo.timeAdministered,
    };
}
function getOrderPackages(oystehr, searchBy) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, encounterRefs, bundle, resources, medicationAdministrations, medicationStatements, resultPackages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    searchParams = [
                        {
                            name: '_tag',
                            value: utils_1.MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
                        },
                        {
                            name: '_include',
                            value: 'MedicationAdministration:subject',
                        },
                        {
                            name: '_include',
                            value: 'MedicationAdministration:performer',
                        },
                        {
                            name: '_include',
                            value: 'MedicationAdministration:request',
                        },
                        {
                            name: '_revinclude',
                            value: 'MedicationStatement:part-of',
                        },
                    ];
                    if (searchBy.field === 'encounterId') {
                        searchParams.push({ name: 'context', value: "Encounter/".concat(searchBy.value) });
                    }
                    else if (searchBy.field === 'encounterIds') {
                        encounterRefs = searchBy.value.map(function (id) { return "Encounter/".concat(id); }).join(',');
                        searchParams.push({ name: 'context', value: encounterRefs });
                    }
                    console.log('searchParams for MedicationAdministration', searchParams);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'MedicationAdministration',
                            params: searchParams,
                        })];
                case 1:
                    bundle = _a.sent();
                    resources = bundle.unbundle();
                    medicationAdministrations = resources.filter(function (res) { return res.resourceType === 'MedicationAdministration'; });
                    medicationStatements = resources.filter(function (res) { return res.resourceType === 'MedicationStatement'; });
                    console.log('All practitioners: ', JSON.stringify(resources.filter(function (res) { return res.resourceType === 'Practitioner'; })));
                    console.log('All medication statements: ', JSON.stringify(medicationStatements));
                    console.log("All orders: ".concat(resources
                        .filter(function (res) { return res.resourceType === 'MedicationAdministration'; })
                        .map(function (ma) { return ma.id; })
                        .join(',\n')));
                    resultPackages = [];
                    medicationAdministrations.forEach(function (ma) {
                        var _a, _b, _c;
                        var patient = resources.find(function (res) { var _a; return res.id === ((_a = ma.subject.reference) === null || _a === void 0 ? void 0 : _a.replace('Patient/', '')); });
                        if (!patient)
                            throw new Error("No patient was found for order: ".concat(ma.id));
                        var idOfProviderCreatedOrder = (0, utils_1.getPractitionerIdThatOrderedMedication)(ma);
                        var providerCreatedOrder = resources.find(function (res) { return res.id === idOfProviderCreatedOrder; });
                        if (!providerCreatedOrder)
                            throw new Error("No practitioner was found for order: ".concat(ma.id));
                        var idOfProviderAdministeredOrder = (_a = (0, utils_1.getProviderIdAndDateMedicationWasAdministered)(ma)) === null || _a === void 0 ? void 0 : _a.administeredProviderId;
                        var providerAdministeredOrder = resources.find(function (res) { return res.id === idOfProviderAdministeredOrder; });
                        var idOfProviderOrderedBy = (0, utils_1.getCurrentOrderedByProviderId)(ma);
                        var providerOrderedBy = idOfProviderOrderedBy
                            ? resources.find(function (res) { return res.id === idOfProviderOrderedBy; })
                            : undefined;
                        var medicationRequestId = (_c = (_b = ma.request) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
                        var medicationRequest = resources.find(function (resource) { return resource.resourceType === 'MedicationRequest' && resource.id === medicationRequestId; });
                        var relatedMedicationStatement = medicationStatements.find(function (ms) { var _a; return (_a = ms.partOf) === null || _a === void 0 ? void 0 : _a.some(function (partOf) { return partOf.reference === "MedicationAdministration/".concat(ma.id); }); });
                        resultPackages.push({
                            medicationAdministration: ma,
                            patient: patient,
                            providerCreatedOrder: providerCreatedOrder,
                            providerAdministeredOrder: providerAdministeredOrder,
                            providerOrderedBy: providerOrderedBy,
                            medicationRequest: medicationRequest,
                            medicationStatement: relatedMedicationStatement,
                        });
                    });
                    return [2 /*return*/, resultPackages];
            }
        });
    });
}
