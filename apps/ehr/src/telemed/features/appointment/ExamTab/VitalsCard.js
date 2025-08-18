"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsCard = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var state_1 = require("../../../state");
var utils_1 = require("../../../utils");
var components_2 = require("./components");
var VitalsCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('vitals'), isCollapsed = _a[0], onSwitch = _a[1];
    var patient = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient']).patient;
    var validationValues = (0, utils_1.getValidationValuesByDOB)(patient.birthDate);
    return (<components_1.AccordionCard label="Vitals" collapsed={isCollapsed} onSwitch={onSwitch}>
      <material_1.Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
        <material_1.Typography variant="subtitle1" fontSize={16} sx={{ whiteSpace: 'nowrap' }}>
          Patient provided:
        </material_1.Typography>
        <components_2.VitalsTemperature validate={function (value) {
            if ((0, utils_1.isEmptyValidation)(value)) {
                return;
            }
            var isNotNumber = (0, utils_1.isNumberValidation)(value);
            if (isNotNumber) {
                return isNotNumber;
            }
            if (+value > validationValues.temperature.high) {
                return 'Invalid temperature';
            }
            return;
        }}/>
        <components_2.VitalsComponent name="vitals-pulse" label="Pulse Ox" validate={function (value) {
            if ((0, utils_1.isEmptyValidation)(value)) {
                return;
            }
            var isNotNumber = (0, utils_1.isNumberValidation)(value);
            if (isNotNumber) {
                return isNotNumber;
            }
            if (+value > validationValues.pulse.high) {
                return 'Invalid pulse';
            }
            return;
        }}/>
        <components_2.VitalsComponent name="vitals-hr" label="HR" validate={function (value) {
            if ((0, utils_1.isEmptyValidation)(value)) {
                return;
            }
            var isNotNumber = (0, utils_1.isNumberValidation)(value);
            if (isNotNumber) {
                return isNotNumber;
            }
            if (+value > validationValues.hr.high) {
                return 'Invalid heart rate';
            }
            return;
        }}/>
        <components_2.VitalsComponent name="vitals-rr" label="RR" validate={function (value) {
            if ((0, utils_1.isEmptyValidation)(value)) {
                return;
            }
            var isNotNumber = (0, utils_1.isNumberValidation)(value);
            if (isNotNumber) {
                return isNotNumber;
            }
            if (+value > validationValues.rr.high) {
                return 'Invalid respiration rate';
            }
            return;
        }}/>
        <components_2.VitalsBloodPressure validate={function (value) {
            var _a = value.split('/'), systolic = _a[0], diastolic = _a[1];
            if ((0, utils_1.isEmptyValidation)(systolic) && (0, utils_1.isEmptyValidation)(diastolic)) {
                return;
            }
            var isNotNumberSystolic = (0, utils_1.isNumberValidation)(systolic);
            var isNotNumberDiastolic = (0, utils_1.isNumberValidation)(diastolic);
            if (isNotNumberSystolic) {
                return "Systolic ".concat(isNotNumberSystolic);
            }
            if (isNotNumberDiastolic) {
                return "Diastolic ".concat(isNotNumberDiastolic);
            }
            return;
        }}/>
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.VitalsCard = VitalsCard;
//# sourceMappingURL=VitalsCard.js.map