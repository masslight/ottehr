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
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var fhir_resources_creation_1 = require("./fhir-resources-creation");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'create-update-medication-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, practitionerId, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                return [4 /*yield*/, (0, helpers_1.practitionerIdFromZambdaInput)(input, validatedParameters.secrets)];
            case 2:
                practitionerId = _a.sent();
                console.log('Created zapToken, fhir and clients.');
                return [4 /*yield*/, performEffect(oystehr, validatedParameters, practitionerId)];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', error_1);
                console.log('Stringified error: ', JSON.stringify(error_1));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
function performEffect(oystehr, params, practitionerIdCalledZambda) {
    return __awaiter(this, void 0, void 0, function () {
        var orderId, newStatus, orderData, orderResources, medicationAdministrationId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    orderId = params.orderId, newStatus = params.newStatus, orderData = params.orderData;
                    if (!(orderId && orderData)) return [3 /*break*/, 2];
                    return [4 /*yield*/, updateOrder(oystehr, orderId, newStatus, orderData, params.interactions, practitionerIdCalledZambda)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, {
                            message: 'Order was updated successfully',
                            id: orderId,
                        }];
                case 2:
                    if (!(orderId && newStatus)) return [3 /*break*/, 5];
                    return [4 /*yield*/, getOrderResources(oystehr, orderId)];
                case 3:
                    orderResources = _a.sent();
                    if (!orderResources)
                        throw new Error("No order found with id: ".concat(orderId));
                    return [4 /*yield*/, changeOrderStatus(oystehr, orderResources, newStatus)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, {
                            message: 'Order status was changed successfully',
                            id: orderId,
                        }];
                case 5:
                    if (!orderData) return [3 /*break*/, 7];
                    return [4 /*yield*/, createOrder(oystehr, orderData, params.interactions, practitionerIdCalledZambda)];
                case 6:
                    medicationAdministrationId = _a.sent();
                    return [2 /*return*/, {
                            message: 'Order was created successfully',
                            id: medicationAdministrationId,
                        }];
                case 7: return [2 /*return*/, { message: 'No action was made because no orderId or orderData was provided' }];
            }
        });
    });
}
function updateOrder(oystehr, orderId, newStatus, orderData, interactions, practitionerIdCalledZambda) {
    return __awaiter(this, void 0, void 0, function () {
        var orderResources, currentStatus, existingMedicationCopy, newMedicationCopy, inventoryMedication, transactionRequests, updatedMedicationAdministration, medicationAdministrationPatchOperations, erxDataFromMedication, medicationCodeableConcept, effectiveDateTime, medicationRequestFullUrl, transactionResult;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('updateOrder');
                    return [4 /*yield*/, getOrderResources(oystehr, orderId)];
                case 1:
                    orderResources = _c.sent();
                    if (!orderResources)
                        throw new Error("No order found with id: ".concat(orderId));
                    currentStatus = (0, utils_1.mapFhirToOrderStatus)(orderResources.medicationAdministration);
                    if (currentStatus !== 'pending' && newStatus)
                        throw new Error("Can't change status if current is not 'pending'. Current status is: ".concat(currentStatus));
                    console.log("Current order status is: ".concat(currentStatus));
                    if (newStatus)
                        (0, helpers_1.validateProviderAccess)(orderData, newStatus, orderResources, practitionerIdCalledZambda);
                    existingMedicationCopy = (0, utils_1.getMedicationFromMA)(orderResources.medicationAdministration);
                    if (!((orderData === null || orderData === void 0 ? void 0 : orderData.medicationId) && (orderData === null || orderData === void 0 ? void 0 : orderData.medicationId) !== utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID)) return [3 /*break*/, 3];
                    console.log('Creating new copy for order');
                    return [4 /*yield*/, (0, helpers_1.getMedicationById)(oystehr, orderData === null || orderData === void 0 ? void 0 : orderData.medicationId)];
                case 2:
                    inventoryMedication = _c.sent();
                    newMedicationCopy = (0, helpers_1.createMedicationCopy)(inventoryMedication, orderData);
                    return [3 /*break*/, 4];
                case 3:
                    if (existingMedicationCopy) {
                        console.log('Updating existing copy for order');
                        // during copy process we also update lotNumber, expDate etc.
                        newMedicationCopy = (0, helpers_1.createMedicationCopy)(existingMedicationCopy, orderData, newStatus);
                    }
                    _c.label = 4;
                case 4:
                    transactionRequests = [];
                    console.log("Updating MedicationAdministration, orderData present: ".concat(Boolean(orderData), ", newMedicationCopy present: ").concat(Boolean(newMedicationCopy), ", newStatus: ").concat(newStatus));
                    updatedMedicationAdministration = undefined;
                    medicationAdministrationPatchOperations = [];
                    if (orderData && newMedicationCopy) {
                        updatedMedicationAdministration = (0, helpers_1.updateMedicationAdministrationData)({
                            orderData: orderData,
                            orderResources: orderResources,
                            administeredProviderId: newStatus !== undefined ? practitionerIdCalledZambda : undefined,
                            orderedByProviderId: orderData.providerId,
                            medicationResource: newMedicationCopy,
                        });
                    }
                    if (currentStatus && newStatus) {
                        if (updatedMedicationAdministration) {
                            updatedMedicationAdministration.status = (0, utils_1.mapOrderStatusToFhir)(newStatus);
                        }
                        else {
                            medicationAdministrationPatchOperations.push((0, utils_1.replaceOperation)('/status', (0, utils_1.mapOrderStatusToFhir)(newStatus)));
                        }
                        if (newStatus === 'administered' || newStatus === 'administered-partly') {
                            if (!newMedicationCopy)
                                throw new Error("Can't create MedicationStatement for order, no Medication copy.");
                            erxDataFromMedication = (_b = (_a = newMedicationCopy.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (code) { return code.system === utils_1.MEDICATION_DISPENSABLE_DRUG_ID; });
                            if (!erxDataFromMedication)
                                throw new Error("Can't create MedicationStatement for order, Medication resource don't have coding with ERX data in it");
                            medicationCodeableConcept = {
                                coding: [__assign(__assign({}, erxDataFromMedication), { display: (0, utils_1.getMedicationName)(newMedicationCopy) })],
                            };
                            effectiveDateTime = (orderData || {}).effectiveDateTime;
                            transactionRequests.push({
                                method: 'POST',
                                url: "/MedicationStatement",
                                // effective date time for MedicationAdministration is date of creation,
                                // and effective date time for MedicationStatement is date of medication was given/taken
                                resource: (0, fhir_resources_creation_1.createMedicationStatementResource)(orderResources.medicationAdministration, medicationCodeableConcept, {
                                    effectiveDateTime: effectiveDateTime,
                                }),
                            });
                        }
                    }
                    if (interactions && newMedicationCopy) {
                        if (orderResources.medicationRequest == null) {
                            medicationRequestFullUrl = 'urn:uuid:' + (0, crypto_1.randomUUID)();
                            transactionRequests.push({
                                method: 'POST',
                                url: "/MedicationRequest",
                                fullUrl: medicationRequestFullUrl,
                                resource: (0, fhir_resources_creation_1.createMedicationRequest)(orderData, interactions, newMedicationCopy),
                            });
                            if (updatedMedicationAdministration) {
                                updatedMedicationAdministration.request = {
                                    reference: medicationRequestFullUrl,
                                };
                            }
                            else {
                                (0, utils_1.replaceOperation)('/request', {
                                    reference: medicationRequestFullUrl,
                                });
                            }
                        }
                        else {
                            transactionRequests.push({
                                method: 'PUT',
                                url: "/MedicationRequest/".concat(orderResources.medicationRequest.id),
                                resource: __assign(__assign({}, (0, fhir_resources_creation_1.createMedicationRequest)(orderData, interactions, newMedicationCopy)), { id: orderResources.medicationRequest.id }),
                            });
                        }
                    }
                    if (updatedMedicationAdministration) {
                        transactionRequests.push({
                            method: 'PUT',
                            url: "/MedicationAdministration/".concat(updatedMedicationAdministration.id),
                            resource: updatedMedicationAdministration,
                        });
                    }
                    if (medicationAdministrationPatchOperations.length > 0) {
                        transactionRequests.push((0, utils_1.getPatchBinary)({
                            resourceType: 'MedicationAdministration',
                            resourceId: orderResources.medicationAdministration.id,
                            patchOperations: medicationAdministrationPatchOperations,
                        }));
                    }
                    console.log('Transaction requests: ', JSON.stringify(transactionRequests));
                    return [4 /*yield*/, oystehr.fhir.transaction({ requests: transactionRequests })];
                case 5:
                    transactionResult = _c.sent();
                    console.log('Transaction result: ', JSON.stringify(transactionResult));
                    return [2 /*return*/];
            }
        });
    });
}
function createOrder(oystehr, orderData, interactions, practitionerIdCalledZambda) {
    return __awaiter(this, void 0, void 0, function () {
        var inventoryMedication, medicationCopy, routeCoding, locationCoding, medicationRequestToCreate, medicationRequestFullUrl, medicationAdministrationToCreate, transactionRequests, transactionResult;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.log('createOrder');
                    if (!orderData.medicationId)
                        throw new Error('No "medicationId" provided');
                    return [4 /*yield*/, (0, helpers_1.getMedicationById)(oystehr, orderData.medicationId)];
                case 1:
                    inventoryMedication = _d.sent();
                    if (inventoryMedication && (0, utils_1.getMedicationTypeCode)(inventoryMedication) !== utils_1.INVENTORY_MEDICATION_TYPE_CODE) {
                        throw new Error("Medication with id ".concat(orderData.medicationId, " is not medication inventory item, can't copy that resource"));
                    }
                    medicationCopy = (0, helpers_1.createMedicationCopy)(inventoryMedication, orderData);
                    console.log("Created medication copy: ".concat((0, utils_1.getMedicationName)(medicationCopy)));
                    routeCoding = (0, utils_1.searchRouteByCode)(orderData.route);
                    if (!routeCoding)
                        throw new Error("No medication appliance route was found for code: ".concat(orderData.route));
                    locationCoding = orderData.location ? (0, utils_1.searchMedicationLocation)(orderData.location) : undefined;
                    if (orderData.location && !locationCoding)
                        throw new Error("No location found with code provided: ".concat(orderData.location));
                    medicationRequestToCreate = (0, fhir_resources_creation_1.createMedicationRequest)(orderData, interactions, medicationCopy);
                    medicationRequestFullUrl = 'urn:uuid:' + (0, crypto_1.randomUUID)();
                    medicationAdministrationToCreate = (0, fhir_resources_creation_1.createMedicationAdministrationResource)({
                        orderData: orderData,
                        status: (0, utils_1.mapOrderStatusToFhir)('pending'),
                        route: routeCoding,
                        location: locationCoding,
                        createdProviderId: practitionerIdCalledZambda,
                        orderedByProviderId: orderData.providerId, // NEW: add initial provider to history
                        dateTimeCreated: luxon_1.DateTime.now().toISO(),
                        medicationResource: medicationCopy,
                    });
                    medicationAdministrationToCreate.request = {
                        reference: medicationRequestFullUrl,
                    };
                    transactionRequests = {
                        requests: [
                            {
                                method: 'POST',
                                fullUrl: medicationRequestFullUrl,
                                url: '/MedicationRequest',
                                resource: medicationRequestToCreate,
                            },
                            {
                                method: 'POST',
                                url: '/MedicationAdministration',
                                resource: medicationAdministrationToCreate,
                            },
                        ],
                    };
                    console.log('Transaction input: ', JSON.stringify(transactionRequests));
                    return [4 /*yield*/, oystehr.fhir.transaction(transactionRequests)];
                case 2:
                    transactionResult = _d.sent();
                    console.log('Transaction result: ', JSON.stringify(transactionResult));
                    return [2 /*return*/, (_c = (_b = (_a = transactionResult.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { var _a; return ((_a = entry === null || entry === void 0 ? void 0 : entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'MedicationAdministration'; })) === null || _b === void 0 ? void 0 : _b.resource) === null || _c === void 0 ? void 0 : _c.id];
            }
        });
    });
}
function changeOrderStatus(oystehr, pkg, newStatus) {
    return __awaiter(this, void 0, void 0, function () {
        var operations, currentStatusFhir, currentStatus, transactionRequests, transactionResult;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("Changing status to: ".concat(newStatus));
                    operations = [];
                    // If cancelling, save the previous status for potential restoration
                    if (newStatus === 'cancelled') {
                        currentStatusFhir = pkg.medicationAdministration.status;
                        currentStatus = (0, utils_1.mapFhirToOrderStatus)(pkg.medicationAdministration);
                        console.log("Saving previous status '".concat(currentStatus, "' (FHIR: '").concat(currentStatusFhir, "') for potential restoration"));
                        operations = (0, utils_1.createCancellationTagOperations)(currentStatusFhir, pkg.medicationAdministration.meta);
                    }
                    operations.push((0, utils_1.replaceOperation)('/status', (0, utils_1.mapOrderStatusToFhir)(newStatus)));
                    transactionRequests = [];
                    transactionRequests.push((0, utils_1.getPatchBinary)({
                        resourceType: 'MedicationAdministration',
                        resourceId: pkg.medicationAdministration.id,
                        patchOperations: operations,
                    }));
                    // If we're cancelling a medication and there's a corresponding MedicationStatement, update its status to 'entered-in-error'
                    if (newStatus === 'cancelled' && pkg.medicationStatement && pkg.medicationStatement.id) {
                        transactionRequests.push((0, utils_1.getPatchBinary)({
                            resourceType: 'MedicationStatement',
                            resourceId: pkg.medicationStatement.id,
                            patchOperations: [(0, utils_1.replaceOperation)('/status', 'entered-in-error')],
                        }));
                        console.log("Adding MedicationStatement ".concat(pkg.medicationStatement.id, " status update to transaction"));
                    }
                    return [4 /*yield*/, oystehr.fhir.transaction({ requests: transactionRequests })];
                case 1:
                    transactionResult = _c.sent();
                    return [2 /*return*/, (_b = (_a = transactionResult.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'MedicationAdministration'; })) === null || _b === void 0 ? void 0 : _b.resource];
            }
        });
    });
}
function getOrderResources(oystehr, orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var bundle, resources, medicationAdministration, patient, medicationStatement, medicationRequestId, medicationRequest;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'MedicationAdministration',
                        params: [
                            {
                                name: '_id',
                                value: orderId,
                            },
                            {
                                name: '_include',
                                value: 'MedicationAdministration:subject',
                            },
                            {
                                name: '_revinclude',
                                value: 'MedicationStatement:part-of',
                            },
                            {
                                name: '_include',
                                value: 'MedicationAdministration:request',
                            },
                        ],
                    })];
                case 1:
                    bundle = _c.sent();
                    resources = bundle.unbundle();
                    medicationAdministration = resources.find(function (res) { return res.resourceType === 'MedicationAdministration'; });
                    if (!medicationAdministration)
                        throw new Error("No medicationAdministration was found with id ".concat(orderId));
                    patient = resources.find(function (res) { return res.resourceType === 'Patient'; });
                    if (!patient)
                        throw new Error("No patient was found for medicationAdministration with id ".concat(orderId));
                    medicationStatement = resources.find(function (res) { return res.resourceType === 'MedicationStatement'; });
                    medicationRequestId = (_b = (_a = medicationAdministration.request) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1];
                    medicationRequest = resources.find(function (resource) { return resource.resourceType === 'MedicationRequest' && resource.id === medicationRequestId; });
                    return [2 /*return*/, {
                            medicationAdministration: medicationAdministration,
                            medicationStatement: medicationStatement,
                            medicationRequest: medicationRequest,
                            patient: patient,
                        }];
            }
        });
    });
}
