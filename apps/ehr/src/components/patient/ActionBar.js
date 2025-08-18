"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionBar = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../constants/data-test-ids");
var ActionBar = function (_a) {
    var handleDiscard = _a.handleDiscard, handleSave = _a.handleSave, loading = _a.loading, hidden = _a.hidden, submitDisabled = _a.submitDisabled;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 999,
            display: hidden ? 'none' : 'flex',
            justifyContent: 'space-between',
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(2, 6),
            borderTop: "1px solid ".concat(theme.palette.divider),
            boxShadow: '0px -3px 3px -2px rgba(0, 0, 0, 0.2)',
        }}>
      <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontWeight: 'bold',
        }} onClick={handleDiscard}>
        Back
      </material_1.Button>
      <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.patientInformationPage.saveChangesButton} variant="contained" color="primary" loading={loading} sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontWeight: 'bold',
        }} disabled={submitDisabled} onClick={handleSave}>
        Save changes
      </lab_1.LoadingButton>
    </material_1.Box>);
};
exports.ActionBar = ActionBar;
//# sourceMappingURL=ActionBar.js.map