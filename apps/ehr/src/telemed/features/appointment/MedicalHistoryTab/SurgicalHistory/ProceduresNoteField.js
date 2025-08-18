"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProceduresNoteFieldSkeleton = exports.ProceduresNoteField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProceduresNoteField = function () {
    var _a, _b, _c;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            text: ((_a = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistoryNote) === null || _a === void 0 ? void 0 : _a.text) || '',
        },
    });
    var control = methods.control;
    var _d = (0, hooks_1.useDebounceNotesField)('surgicalHistoryNote'), onValueChange = _d.onValueChange, isChartDataLoading = _d.isChartDataLoading, isLoading = _d.isLoading;
    if (isReadOnly && !((_b = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistoryNote) === null || _b === void 0 ? void 0 : _b.text)) {
        return null;
    }
    return !isReadOnly ? (<react_hook_form_1.Controller name="text" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.TextField value={value} onChange={function (e) {
                    onChange(e);
                    onValueChange(e.target.value);
                }} label="Provider notes" fullWidth multiline rows={3} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote} disabled={isChartDataLoading} InputProps={{
                    endAdornment: isLoading && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <material_1.CircularProgress size="20px"/>
              </material_1.Box>),
                }}/>);
        }}/>) : (<material_1.Typography>{(_c = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistoryNote) === null || _c === void 0 ? void 0 : _c.text}</material_1.Typography>);
};
exports.ProceduresNoteField = ProceduresNoteField;
var ProceduresNoteFieldSkeleton = function () {
    return (<material_1.Skeleton variant="rounded" width="100%">
      <material_1.TextField multiline rows={3}/>
    </material_1.Skeleton>);
};
exports.ProceduresNoteFieldSkeleton = ProceduresNoteFieldSkeleton;
//# sourceMappingURL=ProceduresNoteField.js.map