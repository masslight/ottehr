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
exports.interactionsUnresolved = exports.findPrescriptionsForInteractions = exports.medicationInteractionsFromErxResponse = exports.getInitialAutoFilledFields = exports.getConfirmSaveModalConfigs = exports.getSaveButtonText = exports.isUnsavedMedicationData = exports.validateAllMedicationFields = exports.validateMedicationField = exports.getFieldType = exports.medicationOrderFieldsWithOptions = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var fieldsConfig_1 = require("./fieldsConfig");
var ReasonSelect_1 = require("./ReasonSelect");
exports.medicationOrderFieldsWithOptions = [
    'medicationId',
    'associatedDx',
    'route',
    'location',
    'units',
    'providerId',
];
var getFieldType = function (field) {
    if (field === 'dose')
        return 'number';
    if (field === 'expDate')
        return 'month';
    if (field === 'effectiveDateTime')
        return 'datetime';
    if (field === 'medicationId')
        return 'autocomplete';
    if (exports.medicationOrderFieldsWithOptions.includes(field))
        return 'select';
    return 'text';
};
exports.getFieldType = getFieldType;
var validateMedicationField = function (field, value, type) {
    var config = fieldsConfig_1.fieldsConfig[type][field];
    return (config === null || config === void 0 ? void 0 : config.isRequired) ? value.toString().trim() !== '' : true;
};
exports.validateMedicationField = validateMedicationField;
var validateAllMedicationFields = function (localValues, medication, type, setFieldErrors) {
    if (medication === void 0) { medication = undefined; }
    var currentFieldsConfig = fieldsConfig_1.fieldsConfig[type];
    var errors = {};
    var missingFields = [];
    Object.entries(currentFieldsConfig).forEach(function (_a) {
        var _b, _c;
        var field = _a[0], config = _a[1];
        if (config.isRequired) {
            var fieldKey = field;
            var value = (_c = (_b = localValues[fieldKey]) !== null && _b !== void 0 ? _b : medication === null || medication === void 0 ? void 0 : medication[fieldKey]) !== null && _c !== void 0 ? _c : '';
            var isValid = (0, exports.validateMedicationField)(field, value, type);
            errors[field] = !isValid;
            if (!isValid) {
                missingFields.push(field);
            }
        }
    });
    setFieldErrors(errors);
    return { isValid: missingFields.length === 0, missingFields: missingFields };
};
exports.validateAllMedicationFields = validateAllMedicationFields;
// this check is used in order-new and order-edit to prevent user from exit page and lose unsaved data
var isUnsavedMedicationData = function (savedMedication, localValues, selectedStatus, getMedicationFieldValue, autoFilledFieldsRef, interactions) {
    if (!savedMedication) {
        return Object.values(localValues).some(function (value) { return value !== '' && value !== undefined; });
    }
    return (selectedStatus !== (savedMedication === null || savedMedication === void 0 ? void 0 : savedMedication.status) ||
        JSON.stringify(interactions) !== JSON.stringify(savedMedication.interactions) ||
        Object.entries(localValues).some(function (_a) {
            var field = _a[0], value = _a[1];
            var isAutofilledField = Object.keys(autoFilledFieldsRef.current).includes(field);
            var savedValue = getMedicationFieldValue(savedMedication, field);
            var isChangedField = (value || savedValue) && value !== savedValue;
            // we don't have autofilled fields in the order-edit or order-edit, so we don't have to check them
            return isAutofilledField ? false : isChangedField;
        }));
};
exports.isUnsavedMedicationData = isUnsavedMedicationData;
var getSaveButtonText = function (currentStatus, type, selectedStatus, isUnsavedData) {
    if ((type === 'dispense' || type === 'dispense-not-administered') && currentStatus === 'pending' && selectedStatus) {
        return "Mark as ".concat(selectedStatus
            .toLocaleLowerCase()
            .split(' ')
            .map(function (word) { return word.charAt(0).toUpperCase() + word.slice(1); })
            .join(' '));
    }
    if (type === 'order-new') {
        return isUnsavedData ? 'Order Medication' : 'Fill Order to Save';
    }
    if (type === 'order-edit' && currentStatus === 'pending') {
        return isUnsavedData ? 'Save' : 'Saved';
    }
    return '';
};
exports.getSaveButtonText = getSaveButtonText;
var getConfirmSaveModalConfigs = function (_a) {
    var _b, _c, _d, _e;
    var patientName = _a.patientName, medicationName = _a.medicationName, newStatus = _a.newStatus, updateRequestInputRef = _a.updateRequestInputRef, setIsReasonSelected = _a.setIsReasonSelected, routeName = _a.routeName;
    var confirmationModalContentJSX = (<material_1.Box display="flex" flexDirection="column" gap={1}>
      <material_1.Typography>
        <strong>Patient:</strong> {patientName}
      </material_1.Typography>
      <material_1.Typography>
        <strong>Medication:</strong> {medicationName} / {(_c = (_b = updateRequestInputRef.current) === null || _b === void 0 ? void 0 : _b.orderData) === null || _c === void 0 ? void 0 : _c.dose}
        {(_e = (_d = updateRequestInputRef.current) === null || _d === void 0 ? void 0 : _d.orderData) === null || _e === void 0 ? void 0 : _e.units} / {routeName}
      </material_1.Typography>
      <material_1.Typography>
        Please confirm that you want to mark this medication order as{' '}
        {<strong>{utils_1.medicationStatusDisplayLabelMap[newStatus] || newStatus}</strong>}
        {newStatus !== 'administered' ? ' and select the reason.' : '.'}
      </material_1.Typography>
    </material_1.Box>);
    var ReasonSelectField = function () { return (<ReasonSelect_1.ReasonSelect updateRequestInputRef={updateRequestInputRef} setIsReasonSelected={setIsReasonSelected}/>); };
    return {
        administered: {
            icon: null,
            color: 'primary.main',
            title: 'Medication Administered',
            confirmText: 'Mark as Administered',
            closeButtonText: 'Cancel',
            showCloseButton: true,
            showConfirmButton: true,
            ContentComponent: function () {
                return confirmationModalContentJSX;
            },
        },
        'administered-partly': {
            icon: null,
            color: 'primary.main',
            title: 'Medication Partly Administered',
            confirmText: 'Mark as Partly Administered',
            closeButtonText: 'Cancel',
            showCloseButton: true,
            showConfirmButton: true,
            ContentComponent: function () { return (<>
          {confirmationModalContentJSX}
          <ReasonSelectField />
        </>); },
        },
        'administered-not': {
            icon: null,
            color: 'primary.main',
            title: 'Medication Not Administered',
            confirmText: 'Mark as Not Administered',
            closeButtonText: 'Cancel',
            showCloseButton: true,
            showConfirmButton: true,
            ContentComponent: function () { return (<>
          {confirmationModalContentJSX}
          <ReasonSelectField />
        </>); },
        },
    };
};
exports.getConfirmSaveModalConfigs = getConfirmSaveModalConfigs;
var getInitialAutoFilledFields = function (medication, autoFilledFieldsRef) {
    var shouldSetDefaultTime = (medication === null || medication === void 0 ? void 0 : medication.status) === 'pending' && !(medication === null || medication === void 0 ? void 0 : medication.effectiveDateTime);
    if (shouldSetDefaultTime) {
        var currentDateTime = luxon_1.DateTime.now().toISO();
        autoFilledFieldsRef.current = {
            effectiveDateTime: currentDateTime,
        };
        return autoFilledFieldsRef.current;
    }
    return {};
};
exports.getInitialAutoFilledFields = getInitialAutoFilledFields;
var SEVERITY_LEVEL_TO_SEVERITY = {
    MinorInteraction: 'low',
    ModerateInteraction: 'moderate',
    MajorInteraction: 'high',
    Unknown: undefined,
};
var medicationInteractionsFromErxResponse = function (response, medicationHistory, prescriptions) {
    var _a, _b;
    var drugInteractions = ((_a = response.medications) !== null && _a !== void 0 ? _a : []).map(function (medication) {
        var _a;
        return {
            drugs: ((_a = medication.medications) !== null && _a !== void 0 ? _a : []).map(function (nestedMedication) { return ({
                id: nestedMedication.id.toString(),
                name: nestedMedication.name,
            }); }),
            severity: SEVERITY_LEVEL_TO_SEVERITY[medication.severityLevel],
            message: medication.message,
        };
    });
    drugInteractions.forEach(function (drugInteraction) {
        var _a, _b, _c;
        var drugIds = drugInteraction.drugs.map(function (drug) { return drug.id; });
        var sourceMedication = medicationHistory.find(function (medication) { return medication.id && drugIds.includes(medication.id); });
        var display = undefined;
        if (sourceMedication && sourceMedication.resourceId && (sourceMedication === null || sourceMedication === void 0 ? void 0 : sourceMedication.chartDataField) && (sourceMedication === null || sourceMedication === void 0 ? void 0 : sourceMedication.type)) {
            display = sourceMedication.chartDataField === 'medications' ? 'Patient' : 'In-house';
            display += sourceMedication.type == 'scheduled' ? ' - Scheduled' : ' - As needed';
            if ((_a = sourceMedication === null || sourceMedication === void 0 ? void 0 : sourceMedication.intakeInfo) === null || _a === void 0 ? void 0 : _a.date) {
                display += '\nlast taken\n' + luxon_1.DateTime.fromISO(sourceMedication.intakeInfo.date).toFormat('MM/dd/yyyy');
            }
            drugInteraction.source = {
                reference: 'Medication/' + sourceMedication.resourceId,
                display: display,
            };
            return;
        }
        var sourcePrescription = prescriptions.find(function (prescription) {
            var _a, _b, _c;
            var code = (_c = (_b = (_a = prescription.medicationCodeableConcept) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === utils_1.MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM; })) === null || _c === void 0 ? void 0 : _c.code;
            return code && drugIds.includes(code);
        });
        var dateString = (_c = (_b = sourcePrescription === null || sourcePrescription === void 0 ? void 0 : sourcePrescription.extension) === null || _b === void 0 ? void 0 : _b.find(function (extension) { return extension.url === 'http://api.zapehr.com/photon-event-time'; })) === null || _c === void 0 ? void 0 : _c.valueDateTime;
        if (sourcePrescription && sourcePrescription.id && dateString) {
            drugInteraction.source = {
                reference: 'MedicationRequest/' + sourcePrescription.id,
                display: 'Prescription\norder added\n' + luxon_1.DateTime.fromISO(dateString).toFormat('MM/dd/yyyy'),
            };
        }
    });
    var allergyInteractions = ((_b = response.allergies) !== null && _b !== void 0 ? _b : []).map(function (allergy) {
        return {
            message: allergy.message,
        };
    });
    return {
        drugInteractions: drugInteractions,
        allergyInteractions: allergyInteractions,
    };
};
exports.medicationInteractionsFromErxResponse = medicationInteractionsFromErxResponse;
var findPrescriptionsForInteractions = function (patientId, interationsResponse, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var interactingDrugIds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                interactingDrugIds = interationsResponse.medications.flatMap(function (medication) { var _a, _b; return (_b = (_a = medication.medications) === null || _a === void 0 ? void 0 : _a.map(function (nestedMedication) { return nestedMedication.id.toString(); })) !== null && _b !== void 0 ? _b : []; });
                if (interactingDrugIds.length === 0) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'MedicationRequest',
                        params: [
                            {
                                name: 'status',
                                value: 'active',
                            },
                            {
                                name: 'subject',
                                value: 'Patient/' + patientId,
                            },
                            {
                                name: '_tag',
                                value: 'erx-medication',
                            },
                            {
                                name: 'code',
                                value: interactingDrugIds.map(function (drugId) { return utils_1.MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM + '|' + drugId; }).join(','),
                            },
                        ],
                    })];
            case 1: return [2 /*return*/, (_a.sent()).unbundle()];
        }
    });
}); };
exports.findPrescriptionsForInteractions = findPrescriptionsForInteractions;
var interactionsUnresolved = function (interactions) {
    var _a, _b;
    var unresolvedInteraction = __spreadArray(__spreadArray([], ((_a = interactions === null || interactions === void 0 ? void 0 : interactions.drugInteractions) !== null && _a !== void 0 ? _a : []), true), ((_b = interactions === null || interactions === void 0 ? void 0 : interactions.allergyInteractions) !== null && _b !== void 0 ? _b : []), true).find(function (interaction) { return interaction.overrideReason == null; });
    return unresolvedInteraction != null;
};
exports.interactionsUnresolved = interactionsUnresolved;
//# sourceMappingURL=utils.js.map