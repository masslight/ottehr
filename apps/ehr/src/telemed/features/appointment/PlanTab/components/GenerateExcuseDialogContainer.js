"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateExcuseDialogContainer = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var GenerateExcuseDialogContainer = function (props) {
    var open = props.open, onClose = props.onClose, onSubmit = props.onSubmit, label = props.label, children = props.children;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <material_1.DialogTitle component="div" sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'flex-start' }}>
        <material_1.Typography variant="h4" color={theme.palette.primary.dark} sx={{ flex: 1 }}>
          {label}
        </material_1.Typography>
        <material_1.IconButton size="small" onClick={onClose}>
          <Close_1.default fontSize="small"/>
        </material_1.IconButton>
      </material_1.DialogTitle>
      <material_1.Divider />

      <material_1.DialogContent sx={{
            p: 3,
        }}>
        {children}
      </material_1.DialogContent>

      <material_1.Divider />
      <material_1.DialogActions sx={{ py: 2, px: 3, display: 'flex', justifyContent: 'space-between' }}>
        <RoundedButton_1.RoundedButton onClick={onClose}>Cancel</RoundedButton_1.RoundedButton>
        <RoundedButton_1.RoundedButton onClick={onSubmit} variant="contained">
          Generate note
        </RoundedButton_1.RoundedButton>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.GenerateExcuseDialogContainer = GenerateExcuseDialogContainer;
//# sourceMappingURL=GenerateExcuseDialogContainer.js.map