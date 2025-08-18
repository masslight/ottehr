"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var PreferredLanguagePopup = function (_a) {
    var onClose = _a.onClose, preferredLanguage = _a.preferredLanguage, isOpen = _a.isOpen;
    var language = preferredLanguage;
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
        mb: 2,
        ml: 1,
    };
    return (<material_1.Dialog open={isOpen} onClose={onClose} fullWidth disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '444px',
                maxWidth: 'initial',
            },
        }}>
      <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
        Patient’s Preferred Language
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.Typography>
          <strong>{language}</strong> is the preferred language for the patient. Please contact the language line if the
          patient needs an interpreter:
          <br />
          {utils_1.INTERPRETER_PHONE_NUMBER}.
          <br />
          This number is always available in the left hand side of the screen.
        </material_1.Typography>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ justifyContent: 'flex-end', mr: 3 }}>
        <material_1.Button onClick={onClose} color="primary" variant="contained" size="medium" sx={buttonSx}>
          OK, Got it
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.default = PreferredLanguagePopup;
//# sourceMappingURL=PreferredLanguagePopup.js.map