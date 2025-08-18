"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteIntakeButton = void 0;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var GenericToolTip_1 = require("../../../components/GenericToolTip");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var CompleteIntakeButton = function (_a) {
    var isDisabled = _a.isDisabled, handleCompleteIntake = _a.handleCompleteIntake, status = _a.status;
    return (<GenericToolTip_1.GenericToolTip title={status !== 'intake' ? 'Only available in Intake status' : null} sx={{
            width: '120px',
            textAlign: 'center',
        }} placement="top">
      <system_1.Box sx={{
            alignSelf: 'center',
        }}>
        <material_1.Button data-testid={data_test_ids_1.dataTestIds.sideMenu.completeIntakeButton} variant="contained" sx={{
            alignSelf: 'center',
            borderRadius: '20px',
            textTransform: 'none',
        }} onClick={handleCompleteIntake} disabled={isDisabled}>
          Complete Intake
        </material_1.Button>
      </system_1.Box>
    </GenericToolTip_1.GenericToolTip>);
};
exports.CompleteIntakeButton = CompleteIntakeButton;
//# sourceMappingURL=CompleteIntakeButton.js.map