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
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var common_1 = require("../common");
var m2mToken;
var ZAMBDA_NAME = 'administer-immunization-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, userToken, oystehrCurrentUser, userPractitionerId, userPractitioner, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
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
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: userPractitionerId,
                    })];
            case 3:
                userPractitioner = _a.sent();
                return [4 /*yield*/, administerImmunizationOrder(oystehr, validatedParameters, userPractitioner)];
            case 4:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 5:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
function administerImmunizationOrder(oystehr, input, userPractitioner) {
    return __awaiter(this, void 0, void 0, function () {
        var orderId, type, reason, details, administrationDetails, medicationAdministration, currentStatus, medication, transactionRequests, transactionResult;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    orderId = input.orderId, type = input.type, reason = input.reason, details = input.details, administrationDetails = input.administrationDetails;
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'MedicationAdministration',
                            id: orderId,
                        })];
                case 1:
                    medicationAdministration = _h.sent();
                    if (medicationAdministration.status !== 'in-progress') {
                        currentStatus = (0, utils_1.mapFhirToOrderStatus)(medicationAdministration);
                        throw new Error("Can't administer order in \"".concat(currentStatus, "\" status"));
                    }
                    return [4 /*yield*/, (0, common_1.updateOrderDetails)(medicationAdministration, details, oystehr)];
                case 2:
                    _h.sent();
                    medicationAdministration.status = (0, utils_1.mapOrderStatusToFhir)(type);
                    medicationAdministration.effectiveDateTime = administrationDetails.administeredDateTime;
                    if (reason) {
                        medicationAdministration.note = [
                            {
                                authorString: utils_1.MEDICATION_ADMINISTRATION_REASON_CODE,
                                text: reason,
                            },
                        ];
                    }
                    (_a = medicationAdministration.performer) === null || _a === void 0 ? void 0 : _a.push({
                        actor: {
                            reference: "Practitioner/".concat(userPractitioner.id),
                            display: (0, utils_1.getFullName)(userPractitioner),
                        },
                        function: {
                            coding: [
                                {
                                    system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                                    code: utils_1.PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
                                },
                            ],
                        },
                    });
                    if (administrationDetails.emergencyContact) {
                        (_b = medicationAdministration.contained) === null || _b === void 0 ? void 0 : _b.push(createEmergencyContactRelatedPerson(medicationAdministration.subject, administrationDetails.emergencyContact));
                        medicationAdministration.supportingInformation = [
                            {
                                reference: '#' + common_1.CONTAINED_EMERGENCY_CONTACT_ID,
                            },
                        ];
                    }
                    medication = (0, common_1.getContainedMedication)(medicationAdministration);
                    if (!medication) {
                        throw new Error('Contained Medication is missing');
                    }
                    if (administrationDetails.lot || administrationDetails.expDate) {
                        medication.batch = {
                            lotNumber: administrationDetails.lot,
                            expirationDate: administrationDetails.expDate,
                        };
                    }
                    (_c = medication.extension) === null || _c === void 0 ? void 0 : _c.push({
                        url: utils_1.VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
                        valueCodeableConcept: (0, utils_1.codeableConcept)(administrationDetails.mvx, utils_1.MVX_CODE_SYSTEM_URL),
                    });
                    (_d = medication.extension) === null || _d === void 0 ? void 0 : _d.push({
                        url: utils_1.VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
                        valueCodeableConcept: (0, utils_1.codeableConcept)(administrationDetails.cvx, utils_1.CVX_CODE_SYSTEM_URL),
                    });
                    (_e = medication.extension) === null || _e === void 0 ? void 0 : _e.push({
                        url: utils_1.VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
                        valueCodeableConcept: (0, utils_1.codeableConcept)(administrationDetails.ndc, utils_1.CODE_SYSTEM_NDC),
                    });
                    if (administrationDetails.cpt) {
                        (_f = medication.extension) === null || _f === void 0 ? void 0 : _f.push({
                            url: utils_1.VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
                            valueCodeableConcept: (0, utils_1.codeableConcept)(administrationDetails.cpt, utils_1.CODE_SYSTEM_CPT),
                        });
                    }
                    if (administrationDetails.visGivenDate) {
                        (_g = medication.extension) === null || _g === void 0 ? void 0 : _g.push({
                            url: utils_1.VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
                            valueDate: administrationDetails.visGivenDate,
                        });
                    }
                    transactionRequests = [
                        {
                            method: 'PUT',
                            url: "/MedicationAdministration/".concat(medicationAdministration.id),
                            resource: medicationAdministration,
                        },
                    ];
                    if (['administered', 'administered-partly'].includes(input.type)) {
                        transactionRequests.push({
                            method: 'POST',
                            url: "/MedicationStatement",
                            resource: createMedicationStatement(medicationAdministration, medication, administrationDetails.administeredDateTime, userPractitioner),
                        });
                    }
                    console.log('Transaction requests: ', JSON.stringify(transactionRequests));
                    return [4 /*yield*/, oystehr.fhir.transaction({ requests: transactionRequests })];
                case 3:
                    transactionResult = _h.sent();
                    console.log('Transaction result: ', JSON.stringify(transactionResult));
                    return [2 /*return*/, {
                            orderId: medicationAdministration.id,
                        }];
            }
        });
    });
}
function validateRequestParameters(input) {
    var _a, _b, _c;
    var _d = (0, shared_1.validateJsonBody)(input), orderId = _d.orderId, type = _d.type, reason = _d.reason, details = _d.details, administrationDetails = _d.administrationDetails;
    var missingFields = [];
    if (!orderId)
        missingFields.push('orderId');
    if (!type)
        missingFields.push('type');
    if (!reason && ['administered-partly', 'administered-not'].includes(type)) {
        missingFields.push('reason');
    }
    missingFields.push.apply(missingFields, (0, common_1.validateOrderDetails)(details));
    if (['administered', 'administered-partly'].includes(type)) {
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.mvx))
            missingFields.push('administrationDetails.mvx');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.cvx))
            missingFields.push('administrationDetails.cvx');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.ndc))
            missingFields.push('administrationDetails.ndc');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.lot))
            missingFields.push('administrationDetails.lot');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.expDate))
            missingFields.push('administrationDetails.expDate');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.administeredDateTime))
            missingFields.push('administrationDetails.administeredDateTime');
        if (!(administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.visGivenDate)) {
            missingFields.push('administrationDetails.visGivenDate');
        }
        if (!((_a = administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.emergencyContact) === null || _a === void 0 ? void 0 : _a.relationship)) {
            missingFields.push('administrationDetails.emergencyContact.relationship');
        }
        if (!((_b = administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.emergencyContact) === null || _b === void 0 ? void 0 : _b.fullName)) {
            missingFields.push('administrationDetails.emergencyContact.fullName');
        }
        if (!((_c = administrationDetails === null || administrationDetails === void 0 ? void 0 : administrationDetails.emergencyContact) === null || _c === void 0 ? void 0 : _c.mobile)) {
            missingFields.push('administrationDetails.emergencyContact.mobile');
        }
    }
    if (missingFields.length > 0)
        throw new Error("Missing required fields [".concat(missingFields.join(', '), "]"));
    return {
        orderId: orderId,
        type: type,
        reason: reason,
        details: details,
        administrationDetails: administrationDetails,
        secrets: input.secrets,
    };
}
function createMedicationStatement(medicationAdministration, medication, administeredDateTime, userPractitioner) {
    var _a, _b, _c, _d, _e, _f;
    var drugIdCoding = (_b = (_a = medication.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (code) { return code.system === utils_1.MEDICATION_DISPENSABLE_DRUG_ID; });
    return {
        resourceType: 'MedicationStatement',
        status: 'active',
        partOf: [(0, utils_1.createReference)(medicationAdministration)],
        medicationReference: drugIdCoding ? undefined : { reference: '#' + common_1.CONTAINED_MEDICATION_ID },
        medicationCodeableConcept: drugIdCoding
            ? {
                coding: [__assign(__assign({}, drugIdCoding), { display: (0, utils_1.getMedicationName)(medication) })],
            }
            : undefined,
        dosage: [
            {
                text: (_c = medicationAdministration.dosage) === null || _c === void 0 ? void 0 : _c.text,
                doseAndRate: [
                    {
                        doseQuantity: (_d = medicationAdministration.dosage) === null || _d === void 0 ? void 0 : _d.dose,
                    },
                ],
                route: (_e = medicationAdministration.dosage) === null || _e === void 0 ? void 0 : _e.route,
                site: (_f = medicationAdministration.dosage) === null || _f === void 0 ? void 0 : _f.site,
            },
        ],
        subject: medicationAdministration.subject,
        informationSource: __assign(__assign({}, (0, utils_1.createReference)(userPractitioner)), { display: (0, utils_1.getFullName)(userPractitioner) }),
        effectiveDateTime: administeredDateTime,
        meta: (0, shared_1.fillMeta)('immunization', 'immunization'),
        contained: drugIdCoding ? undefined : [medication],
    };
}
function createEmergencyContactRelatedPerson(patientReference, emergencyContact) {
    var relationshipCoding = utils_1.EMERGENCY_CONTACT_RELATIONSHIPS.find(function (relationship) { return relationship.code === emergencyContact.relationship; });
    return {
        resourceType: 'RelatedPerson',
        id: common_1.CONTAINED_EMERGENCY_CONTACT_ID,
        patient: patientReference,
        name: [
            {
                text: emergencyContact.fullName,
            },
        ],
        telecom: [
            {
                system: 'phone',
                use: 'mobile',
                value: emergencyContact.mobile,
            },
        ],
        relationship: relationshipCoding
            ? [
                {
                    coding: [
                        {
                            system: relationshipCoding.system,
                            code: relationshipCoding.code,
                            display: relationshipCoding.display,
                        },
                    ],
                },
            ]
            : undefined,
    };
}
