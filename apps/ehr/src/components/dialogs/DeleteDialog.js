"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DeleteDialog;
var material_1 = require("@mui/material");
function DeleteDialog(_a) {
    var closeButtonText = _a.closeButtonText, handleClose = _a.handleClose, description = _a.description, deleteButtonText = _a.deleteButtonText, handleDelete = _a.handleDelete, open = _a.open, title = _a.title;
    var theme = (0, material_1.useTheme)();
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    return (<material_1.Dialog open={open} onClose={handleClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 2,
            },
        }}>
      <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '80%' }}>
        {title}
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.DialogContentText sx={{
            color: theme.palette.text.primary,
        }}>
          {description}
        </material_1.DialogContentText>
      </material_1.DialogContent>
      <material_1.DialogActions>
        <material_1.Button variant="outlined" onClick={handleClose} size="medium" sx={buttonSx}>
          {closeButtonText}
        </material_1.Button>
        <material_1.Button variant="contained" onClick={handleDelete} size="medium" color="error" sx={buttonSx}>
          {deleteButtonText}
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
}
//# sourceMappingURL=DeleteDialog.js.map