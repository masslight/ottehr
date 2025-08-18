"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDialog = void 0;
var icons_material_1 = require("@mui/icons-material");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../constants/data-test-ids");
var CustomDialog = function (_a) {
    var open = _a.open, handleClose = _a.handleClose, title = _a.title, description = _a.description, _b = _a.closeButton, closeButton = _b === void 0 ? true : _b, closeButtonText = _a.closeButtonText, handleConfirm = _a.handleConfirm, confirmText = _a.confirmText, confirmLoading = _a.confirmLoading, error = _a.error, disabled = _a.disabled;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Dialog open={open} onClose={handleClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 2,
            },
        }}>
      <material_1.DialogTitle variant="h5" color="secondary.main" sx={{ width: '100%', fontSize: '20px', color: theme.palette.primary.dark, fontWeight: '600 !important' }} data-testid={data_test_ids_1.dataTestIds.dialog.title}>
        {title}
        {closeButton && (<material_1.IconButton aria-label="Close" onClick={handleClose} sx={{
                position: 'absolute',
                right: 8,
                top: 8,
            }} data-testid={data_test_ids_1.dataTestIds.dialog.closeButton}>
            <icons_material_1.Close />
          </material_1.IconButton>)}
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.DialogContentText sx={{
            color: theme.palette.text.primary,
        }}>
          {description}
        </material_1.DialogContentText>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ justifyContent: 'start', px: 2 }}>
        {handleConfirm && (<lab_1.LoadingButton disabled={disabled} loading={confirmLoading} variant="contained" onClick={handleConfirm} sx={{
                fontWeight: 500,
                borderRadius: '100px',
                mr: '8px',
                textTransform: 'none',
            }} data-testid={data_test_ids_1.dataTestIds.dialog.proceedButton}>
            {confirmText}
          </lab_1.LoadingButton>)}
        <material_1.Button variant={handleConfirm ? 'text' : 'contained'} onClick={handleClose} sx={{
            fontWeight: 500,
            borderRadius: '100px',
            textTransform: 'none',
        }} data-testid={data_test_ids_1.dataTestIds.dialog.cancelButton}>
          {closeButtonText}
        </material_1.Button>
      </material_1.DialogActions>
      {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
          {error}
        </material_1.Typography>)}
    </material_1.Dialog>);
};
exports.CustomDialog = CustomDialog;
//# sourceMappingURL=CustomDialog.js.map