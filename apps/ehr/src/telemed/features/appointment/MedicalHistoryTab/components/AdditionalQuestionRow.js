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
exports.AdditionalQuestionView = exports.AdditionalQuestionEdit = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var NavigationContext_1 = require("../../../../../features/css-module/context/NavigationContext");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var AdditionalQuestionEdit = function (_a) {
    var label = _a.label, field = _a.field, value = _a.value, isChartDataLoading = _a.isChartDataLoading;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'updateObservation']), chartData = _b.chartData, updateObservation = _b.updateObservation;
    var _c = (0, state_1.useSaveChartData)(), mutate = _c.mutate, isLoading = _c.isLoading;
    var normalizedValue = value !== undefined ? String(value) : '';
    (0, react_1.useEffect)(function () {
        var _a;
        (0, NavigationContext_1.setNavigationDisable)((_a = {}, _a["additional-question-".concat(label)] = isLoading, _a));
    }, [isLoading, label]);
    var onChange = function (value, field) {
        var _a;
        var currentObservation = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === field; });
        var newValue = (0, utils_1.convertToBoolean)(value);
        if ((currentObservation === null || currentObservation === void 0 ? void 0 : currentObservation.value) === newValue)
            return;
        var updatedObservation = currentObservation
            ? __assign(__assign({}, currentObservation), { value: newValue }) : { field: field, value: newValue };
        mutate({
            observations: [updatedObservation],
        }, {
            onSuccess: function (data) {
                if (!data.chartData.observations)
                    return;
                var updatedObservation = data.chartData.observations[0];
                if (!updatedObservation)
                    return;
                updateObservation(updatedObservation);
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while updating additional questions. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    return (<material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(field)}>
      <material_1.Typography sx={{ flex: '0 1 calc(100% - 98px)' }}>{label}</material_1.Typography>
      {isChartDataLoading ? (<material_1.Skeleton variant="rectangular" width={100} height={25}/>) : (<material_1.FormControl sx={{ flex: '0 0 88px' }}>
          <material_1.RadioGroup sx={{ flexDirection: 'row', flexWrap: 'nowrap' }} name={field} value={normalizedValue} onChange={function (e) { return onChange(e.target.value, field); }}>
            <material_1.FormControlLabel value="true" control={<material_1.Radio disabled={isLoading} sx={{ p: 0 }}/>} label="Yes"/>
            <material_1.FormControlLabel sx={{ mr: 0 }} value="false" control={<material_1.Radio disabled={isLoading} sx={{ p: 0 }}/>} label="No"/>
          </material_1.RadioGroup>
        </material_1.FormControl>)}
    </material_1.Box>);
};
exports.AdditionalQuestionEdit = AdditionalQuestionEdit;
var AdditionalQuestionView = function (_a) {
    var label = _a.label, value = _a.value, isLoading = _a.isLoading, field = _a.field;
    return (<material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(field)}>
    <material_1.Typography>{label}</material_1.Typography>
    {isLoading ? (<material_1.Skeleton>
        <material_1.Typography>Yes</material_1.Typography>
      </material_1.Skeleton>) : (<material_1.Typography>{value === true ? 'Yes' : value === false ? 'No' : ''}</material_1.Typography>)}
  </material_1.Box>);
};
exports.AdditionalQuestionView = AdditionalQuestionView;
//# sourceMappingURL=AdditionalQuestionRow.js.map