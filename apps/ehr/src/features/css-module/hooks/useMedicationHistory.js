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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMedicationHistory = exports.COLLAPSED_MEDS_COUNT = exports.PATIENT_MEDS_COUNT_TO_LOAD = exports.MEDICATION_HISTORY_FIELDS = void 0;
var utils_1 = require("utils");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var useChartData_1 = require("./useChartData");
exports.MEDICATION_HISTORY_FIELDS = ['medications', 'inhouseMedications'];
exports.PATIENT_MEDS_COUNT_TO_LOAD = 100;
exports.COLLAPSED_MEDS_COUNT = 3;
var SEARCH_PARAMS = {
    medications: {
        _sort: '-effective',
        _include: 'MedicationStatement:source',
        _tag: 'current-medication',
    },
    inhouseMedications: {
        _sort: '-effective',
        _include: 'MedicationStatement:source',
        _tag: 'in-house-medication',
    },
};
var useMedicationHistory = function (_a) {
    var _b;
    var _c = _a === void 0 ? {} : _a, _d = _c.search_by, search_by = _d === void 0 ? 'patient' : _d, _e = _c.count, count = _e === void 0 ? exports.PATIENT_MEDS_COUNT_TO_LOAD : _e, _f = _c.chartDataFields, chartDataFields = _f === void 0 ? exports.MEDICATION_HISTORY_FIELDS : _f;
    var encounter = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['encounter']).encounter;
    var requestedFields = chartDataFields.reduce(function (acc, field) {
        acc[field] = __assign(__assign({}, SEARCH_PARAMS[field]), { _search_by: search_by, _count: count });
        return acc;
    }, {});
    var _g = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: requestedFields,
        enabled: !!encounter.id,
    }), isLoading = _g.isLoading, historyData = _g.chartData, refetchHistory = _g.refetch;
    /**
     * Enrich medication records with practitioner details.
     * _include=MedicationStatement:source fetches related Practitioner resources.
     * Replace practitioner references with full objects for display.
     * todo: consider to move this logic to the backend
     */
    if ((_b = historyData === null || historyData === void 0 ? void 0 : historyData.practitioners) === null || _b === void 0 ? void 0 : _b.length) {
        chartDataFields.forEach(function (field) {
            var _a;
            (_a = historyData[field]) === null || _a === void 0 ? void 0 : _a.forEach(function (val) {
                var _a;
                if ('practitioner' in val &&
                    val.practitioner &&
                    'reference' in val.practitioner &&
                    val.practitioner.reference) {
                    var ref_1 = (0, utils_1.removePrefix)('Practitioner/', val.practitioner.reference);
                    var practitioner = (_a = historyData.practitioners) === null || _a === void 0 ? void 0 : _a.find(function (practitioner) { return practitioner.id === ref_1; });
                    val.practitioner = practitioner;
                }
            });
        });
    }
    var combinedMedicationHistory = chartDataFields
        .flatMap(function (field) {
        var fieldData = (historyData === null || historyData === void 0 ? void 0 : historyData[field]) || [];
        return fieldData.map(function (medication) { return (__assign(__assign({}, medication), { chartDataField: field })); });
    })
        .sort(function (a, b) {
        var FALLBACK_DATE = 0; // move elements without date to the end of the list
        var dateA = (a === null || a === void 0 ? void 0 : a.intakeInfo.date) ? new Date(a.intakeInfo.date) : FALLBACK_DATE;
        var dateB = (b === null || b === void 0 ? void 0 : b.intakeInfo.date) ? new Date(b.intakeInfo.date) : FALLBACK_DATE;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return {
        isLoading: isLoading,
        medicationHistory: combinedMedicationHistory,
        refetchHistory: refetchHistory,
    };
};
exports.useMedicationHistory = useMedicationHistory;
//# sourceMappingURL=useMedicationHistory.js.map