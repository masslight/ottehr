"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChiefComplaintProviderColumnSkeleton = exports.ChiefComplaintProviderColumnReadOnly = exports.ChiefComplaintProviderColumn = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ChiefComplaintProviderColumn = function () {
    var _a, _b;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            chiefComplaint: ((_a = chartData === null || chartData === void 0 ? void 0 : chartData.chiefComplaint) === null || _a === void 0 ? void 0 : _a.text) || '',
            ros: ((_b = chartData === null || chartData === void 0 ? void 0 : chartData.ros) === null || _b === void 0 ? void 0 : _b.text) || '',
        },
    });
    var control = methods.control;
    var _c = (0, hooks_1.useDebounceNotesField)('chiefComplaint'), onChiefComplaintChange = _c.onValueChange, isChiefComplaintLoading = _c.isLoading, isChiefComplaintChartDataLoading = _c.isChartDataLoading;
    var _d = (0, hooks_1.useDebounceNotesField)('ros'), onRosChange = _d.onValueChange, isRosLoading = _d.isLoading, isRosChartDataLoading = _d.isChartDataLoading;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <react_hook_form_1.Controller name="chiefComplaint" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.TextField value={value} onChange={function (e) {
                    onChange(e);
                    onChiefComplaintChange(e.target.value);
                }} disabled={isChiefComplaintChartDataLoading} label="HPI provider notes" fullWidth multiline rows={3} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes} InputProps={{
                    endAdornment: isChiefComplaintLoading && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <material_1.CircularProgress size="20px"/>
                </material_1.Box>),
                }}/>);
        }}/>

      <react_hook_form_1.Controller name="ros" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.TextField value={value} onChange={function (e) {
                    onChange(e);
                    onRosChange(e.target.value);
                }} disabled={isRosChartDataLoading} label="ROS (optional)" fullWidth multiline data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos} InputProps={{
                    endAdornment: isRosLoading && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <material_1.CircularProgress size="20px"/>
                </material_1.Box>),
                }}/>);
        }}/>
    </material_1.Box>);
};
exports.ChiefComplaintProviderColumn = ChiefComplaintProviderColumn;
var ChiefComplaintProviderColumnReadOnly = function () {
    var _a, _b;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var chiefComplaint = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.chiefComplaint) === null || _a === void 0 ? void 0 : _a.text;
    var ros = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.ros) === null || _b === void 0 ? void 0 : _b.text;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {chiefComplaint && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <material_1.Typography variant="subtitle2" color="primary.dark">
            HPI provider notes
          </material_1.Typography>
          <material_1.Typography>{chiefComplaint}</material_1.Typography>
        </material_1.Box>)}

      {ros && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <material_1.Typography variant="subtitle2" color="primary.dark">
            ROS provider notes
          </material_1.Typography>
          <material_1.Typography>{ros}</material_1.Typography>
        </material_1.Box>)}
    </material_1.Box>);
};
exports.ChiefComplaintProviderColumnReadOnly = ChiefComplaintProviderColumnReadOnly;
var ChiefComplaintProviderColumnSkeleton = function () {
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <material_1.Skeleton variant="rounded" width="100%">
        <material_1.TextField multiline rows={3}/>
      </material_1.Skeleton>
      <material_1.Skeleton variant="rounded">
        <material_1.FormControlLabel control={<material_1.Switch />} label="Add ROS"/>
      </material_1.Skeleton>
    </material_1.Box>);
};
exports.ChiefComplaintProviderColumnSkeleton = ChiefComplaintProviderColumnSkeleton;
//# sourceMappingURL=ChiefComplaintProviderColumn.js.map