"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMedicationManagement = void 0;
var luxon_1 = require("luxon");
var react_1 = require("react");
var medicationTypes_1 = require("../components/medication-administration/medicationTypes");
var useMedicationOperations_1 = require("./useMedicationOperations");
var useMedicationManagement = function () {
    var _a = (0, useMedicationOperations_1.useMedicationAPI)(), medications = _a.medications, loadMedications = _a.loadMedications, updateMedication = _a.updateMedication, deleteMedication = _a.deleteMedication;
    var getMedicationById = (0, react_1.useCallback)(function (id) { return medications === null || medications === void 0 ? void 0 : medications.find(function (med) { return med.id === id; }); }, [medications]);
    var getIsMedicationEditable = function (type, medication) {
        return {
            'order-new': true,
            'order-edit': (medication === null || medication === void 0 ? void 0 : medication.status) === 'pending',
            dispense: (medication === null || medication === void 0 ? void 0 : medication.status) === 'pending',
            'dispense-not-administered': (medication === null || medication === void 0 ? void 0 : medication.status) === 'pending',
        }[type];
    };
    var getAvailableStatuses = (0, react_1.useCallback)(function (currentStatus) {
        return medicationTypes_1.statusTransitions[currentStatus] || [];
    }, []);
    var isValidStatusTransition = (0, react_1.useCallback)(function (currentStatus, newStatus) {
        return getAvailableStatuses(currentStatus).includes(newStatus);
    }, [getAvailableStatuses]);
    var pendingMedications = (0, react_1.useMemo)(function () { var _a; return (_a = medications === null || medications === void 0 ? void 0 : medications.filter) === null || _a === void 0 ? void 0 : _a.call(medications, function (med) { return med.status === 'pending'; }); }, [medications]);
    var completedMedications = (0, react_1.useMemo)(function () { var _a; return (_a = medications === null || medications === void 0 ? void 0 : medications.filter) === null || _a === void 0 ? void 0 : _a.call(medications, function (med) { return med.status !== 'pending'; }); }, [medications]);
    var formatDate = (0, react_1.useCallback)(function (dateString) {
        if (!dateString)
            return '';
        var date = luxon_1.DateTime.fromISO(dateString);
        return date.isValid ? date.toFormat('yyyy-MM-dd') : '';
    }, []);
    var formatTime = (0, react_1.useCallback)(function (timeString) {
        if (!timeString)
            return '';
        var time = luxon_1.DateTime.fromFormat(timeString, 'h:mm a');
        return time.isValid ? time.toFormat('HH:mm') : '';
    }, []);
    var canEditMedication = (0, react_1.useCallback)(function (medication) {
        return medication.status === 'pending';
    }, []);
    var warnings = (0, react_1.useMemo)(function () {
        // TODO: add allergy warnings
        return [];
    }, []);
    var getMedicationFieldValue = (0, react_1.useCallback)(function (medication, field, type) {
        var value = medication[field];
        if (type === 'date') {
            return formatDate(value);
        }
        else if (type === 'time') {
            return formatTime(value);
        }
        return value || '';
    }, [formatDate, formatTime]);
    return {
        medications: medications,
        getMedicationById: getMedicationById,
        updateMedication: updateMedication,
        deleteMedication: deleteMedication,
        getAvailableStatuses: getAvailableStatuses,
        isValidStatusTransition: isValidStatusTransition,
        pendingMedications: pendingMedications,
        completedMedications: completedMedications,
        canEditMedication: canEditMedication,
        warnings: warnings,
        getMedicationFieldValue: getMedicationFieldValue,
        loadMedications: loadMedications,
        getIsMedicationEditable: getIsMedicationEditable,
    };
};
exports.useMedicationManagement = useMedicationManagement;
//# sourceMappingURL=useMedicationManagement.js.map