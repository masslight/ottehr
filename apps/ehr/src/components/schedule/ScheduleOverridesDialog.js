"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ScheduleOverridesDialog;
var colors_1 = require("@ehrTheme/colors");
var WarningAmber_1 = require("@mui/icons-material/WarningAmber");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
function ScheduleOverridesDialog(_a) {
    var handleClose = _a.handleClose, open = _a.open, loading = _a.loading, handleConfirm = _a.handleConfirm;
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    var theme = (0, material_1.useTheme)();
    return (<material_1.Dialog open={open} onClose={handleClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '35%',
            },
        }}>
      <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%', fontWeight: 600 }}>
        Schedule change may affect visits
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.DialogContentText sx={{
            color: theme.palette.text.primary,
        }}>
          Your changes will be applied immediately after confirmation. Please make sure that no previously booked visits
          are affected by this schedule change.
        </material_1.DialogContentText>
        <material_1.Box sx={{
            marginTop: 1,
            padding: 1,
            background: colors_1.otherColors.dialogNote,
            borderRadius: '4px',
        }} display="flex">
          <WarningAmber_1.default sx={{ marginTop: 1, color: colors_1.otherColors.warningIcon }}/>
          <material_1.Typography variant="body2" color="#212130" sx={{ m: 1.25 }}>
            If there are conflicts in booked visits and new schedule, please contact patients to move their visits.
          </material_1.Typography>
        </material_1.Box>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ justifyContent: 'flex-start' }}>
        <lab_1.LoadingButton loading={loading} variant="contained" color="primary" size="medium" sx={buttonSx} type="submit" onClick={function (e) {
            e.preventDefault();
            handleConfirm();
        }}>
          Confirm schedule change
        </lab_1.LoadingButton>
        <material_1.Button variant="text" onClick={handleClose} size="medium" sx={buttonSx}>
          Cancel
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
}
//# sourceMappingURL=ScheduleOverridesDialog.js.map