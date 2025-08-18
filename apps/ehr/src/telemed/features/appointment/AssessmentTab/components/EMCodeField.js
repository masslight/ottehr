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
exports.emCodeOptions = exports.EMCodeField = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var EMCodeField = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _a.chartData, setPartialChartData = _a.setPartialChartData;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var _b = (0, state_1.useSaveChartData)(), saveChartData = _b.mutate, isSaveLoading = _b.isLoading;
    var _c = (0, state_1.useDeleteChartData)(), deleteChartData = _c.mutate, isDeleteLoading = _c.isLoading;
    var onChange = function (value) {
        if (value) {
            var prevValue_1 = emCode;
            saveChartData({ emCode: __assign(__assign({}, emCode), value) }, {
                onSuccess: function (data) {
                    var _a;
                    var saved = (_a = data.chartData) === null || _a === void 0 ? void 0 : _a.emCode;
                    if (saved) {
                        setPartialChartData({ emCode: saved });
                    }
                },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
                    setPartialChartData({ emCode: prevValue_1 });
                },
            });
            setPartialChartData({ emCode: value });
        }
        else {
            deleteChartData({ emCode: emCode });
            setPartialChartData({ emCode: undefined });
        }
    };
    return (<material_1.Autocomplete disabled={isSaveLoading || isDeleteLoading} options={exports.emCodeOptions} data-testid={data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown} isOptionEqualToValue={function (option, value) { return option.code === value.code; }} value={emCode ? { display: emCode.display, code: emCode.code } : null} getOptionLabel={function (option) { return option.display; }} onChange={function (_e, value) { return onChange(value); }} renderInput={function (params) { return <material_1.TextField {...params} size="small" label="E&M code" placeholder="Search E&M code"/>; }}/>);
};
exports.EMCodeField = EMCodeField;
exports.emCodeOptions = [
    { display: '99201 New Patient - E/M Level 1', code: '99201' },
    { display: '99202 New Patient - E/M Level 2', code: '99202' },
    { display: '99203 New Patient - E/M Level 3', code: '99203' },
    { display: '99204 New Patient - E/M Level 4', code: '99204' },
    { display: '99205 New Patient - E/M Level 5', code: '99205' },
    { display: '99212 Established Patient - E/M Level 2', code: '99212' },
    { display: '99213 Established Patient - E/M Level 3', code: '99213' },
    { display: '99214 Established Patient - E/M Level 4', code: '99214' },
    { display: '99215 Established Patient - E/M Level 5', code: '99215' },
];
//# sourceMappingURL=EMCodeField.js.map