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
exports.useDebounceNotesField = void 0;
var notistack_1 = require("notistack");
var react_1 = require("react");
var useChartData_1 = require("src/features/css-module/hooks/useChartData");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var nameToTypeEnum = {
    chiefComplaint: 'text',
    ros: 'text',
    surgicalHistoryNote: 'text',
    medicalDecision: 'text',
    addendumNote: 'text',
};
var mapValueToLabel = {
    chiefComplaint: 'HPI note',
    ros: 'ROS note',
    surgicalHistoryNote: 'Surgical history note',
    medicalDecision: 'Medical Decision Making note',
    addendumNote: 'Addendum note',
};
var requestedFieldsOptions = {
    chiefComplaint: { _tag: 'chief-complaint' },
    ros: { _tag: 'ros' },
    surgicalHistoryNote: { _tag: 'surgical-history-note' },
    medicalDecision: { _tag: 'medical-decision' },
    addendumNote: {},
};
var useDebounceNotesField = function (name) {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'encounter',
        'chartData',
        'setPartialChartData',
    ]), encounter = _b.encounter, chartData = _b.chartData, setPartialChartData = _b.setPartialChartData;
    var _c = (0, state_1.useSaveChartData)(), saveChartData = _c.mutate, isSaveLoading = _c.isLoading;
    var _d = (0, state_1.useDeleteChartData)(), deleteChartData = _d.mutate, isDeleteLoading = _d.isLoading;
    var isChartDataLoading = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: (_a = {},
            _a[name] = requestedFieldsOptions[name],
            _a),
        onSuccess: function (data) {
            state_1.useAppointmentStore.setState(function (prevState) {
                var _a;
                var _b;
                return (__assign(__assign({}, prevState), { chartData: __assign(__assign({}, prevState.chartData), (_a = { patientId: ((_b = prevState.chartData) === null || _b === void 0 ? void 0 : _b.patientId) || '' }, _a[name] = data[name], _a)) }));
            });
        },
    }).isLoading;
    var timeoutRef = (0, react_1.useRef)();
    var isLoading = isSaveLoading || isDeleteLoading;
    var onValueChange = function (text) {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = undefined;
        }
        timeoutRef.current = setTimeout(function () {
            var _a, _b, _c;
            var _d;
            text = text.trim();
            var variables = (_a = {},
                _a[name] = (_b = {
                        resourceId: (_d = chartData === null || chartData === void 0 ? void 0 : chartData[name]) === null || _d === void 0 ? void 0 : _d.resourceId
                    },
                    _b[nameToTypeEnum[name]] = text,
                    _b),
                _a);
            if (text) {
                saveChartData(variables, {
                    onSuccess: function (data) {
                        var _a;
                        setPartialChartData((_a = {}, _a[name] = data.chartData[name], _a));
                    },
                    onError: function () {
                        (0, notistack_1.enqueueSnackbar)("".concat(mapValueToLabel[name], " field was not saved. Please change it's value to try again."), {
                            variant: 'error',
                        });
                    },
                });
            }
            else {
                setPartialChartData((_c = {}, _c[name] = undefined, _c));
                deleteChartData(variables, {
                    onError: function () {
                        (0, notistack_1.enqueueSnackbar)("".concat(mapValueToLabel[name], " field was not saved. Please change it's value to try again."), {
                            variant: 'error',
                        });
                    },
                });
            }
        }, 700);
    };
    return { onValueChange: onValueChange, isLoading: isLoading, isChartDataLoading: isChartDataLoading };
};
exports.useDebounceNotesField = useDebounceNotesField;
//# sourceMappingURL=useDebounceNotesField.js.map