"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInfoConfirmedCheckbox = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var PatientInfoConfirmedCheckbox = function () {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _b.chartData, setPartialChartData = _b.setPartialChartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var _c = (0, state_1.useSaveChartData)(), mutate = _c.mutate, isLoading = _c.isLoading;
    var patientInfoConfirmed = ((_a = chartData === null || chartData === void 0 ? void 0 : chartData.patientInfoConfirmed) === null || _a === void 0 ? void 0 : _a.value) || false;
    var onChange = function (value) {
        setPartialChartData({ patientInfoConfirmed: { value: value } });
        mutate({ patientInfoConfirmed: { value: value } }, {
            onSuccess: function (data) {
                var patientInfoConfirmedUpdated = data.chartData.patientInfoConfirmed;
                if (patientInfoConfirmedUpdated) {
                    setPartialChartData({ patientInfoConfirmed: patientInfoConfirmedUpdated });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while confirming patient information. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({ patientInfoConfirmed: chartData === null || chartData === void 0 ? void 0 : chartData.patientInfoConfirmed });
            },
        });
    };
    return (<material_1.FormControlLabel control={<material_1.Checkbox disabled={isLoading || isReadOnly} checked={patientInfoConfirmed} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.patientInfoConfirmationCheckbox} onChange={function (e) { return onChange(e.target.checked); }}/>} label="I confirmed patient's name, DOB, introduced myself and gave my licensure and credentials"/>);
};
exports.PatientInfoConfirmedCheckbox = PatientInfoConfirmedCheckbox;
//# sourceMappingURL=PatientInfoConfirmedCheckbox.js.map