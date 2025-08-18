"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentMedicationGroup = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var formatDateTime_1 = require("../../../../../helpers/formatDateTime");
var components_1 = require("../../../../components");
var MedHistorySubsectionTypography_1 = require("../../../../components/MedHistorySubsectionTypography");
var hooks_1 = require("../../../../hooks");
var CurrentMedicationGroup = function (_a) {
    var label = _a.label, medications = _a.medications, isLoading = _a.isLoading, onRemove = _a.onRemove, dataTestId = _a.dataTestId;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
        }} data-testid={dataTestId}>
      <MedHistorySubsectionTypography_1.MedHistorySubsectionTypography sx={{ pb: 0.5 }}>{label}</MedHistorySubsectionTypography_1.MedHistorySubsectionTypography>
      <components_1.ActionsList data={medications} getKey={function (value) { return value.resourceId; }} itemDataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(dataTestId)} renderItem={function (value) { return <CurrentMedicationItem value={value}/>; }} renderActions={isReadOnly
            ? undefined
            : function (value) { return <components_1.DeleteIconButton disabled={isLoading} onClick={function () { return onRemove(value.resourceId); }}/>; }} divider/>
    </material_1.Box>);
};
exports.CurrentMedicationGroup = CurrentMedicationGroup;
function CurrentMedicationItem(_a) {
    var _b;
    var value = _a.value;
    var lastIntakeDate = value.intakeInfo.date && luxon_1.DateTime.fromISO(value.intakeInfo.date);
    var lastIntakeDateDisplay = '';
    if (lastIntakeDate instanceof luxon_1.DateTime) {
        lastIntakeDateDisplay = "".concat(lastIntakeDate.toFormat(formatDateTime_1.DATE_FORMAT), " at ").concat(lastIntakeDate.toFormat('HH:mm a'));
    }
    var additionalInfo = [(_b = value.intakeInfo) === null || _b === void 0 ? void 0 : _b.dose, lastIntakeDateDisplay].filter(Boolean).join(' ');
    return (<material_1.Typography variant="body2">
      {value.name}
      {additionalInfo ? "(".concat(additionalInfo, ")") : ''}
    </material_1.Typography>);
}
//# sourceMappingURL=CurrentMedicationGroup.js.map