"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var HearingRelayPopup = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var onClose = _a.onClose, isOpen = _a.isOpen;
    var questionnaireResponse = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['questionnaireResponse']).questionnaireResponse;
    var patientPhoneNumber = ((_d = (_c = (_b = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-number', questionnaireResponse)) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString) ||
        ((_g = (_f = (_e = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-number', questionnaireResponse)) === null || _e === void 0 ? void 0 : _e.answer) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.valueString) ||
        '';
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
        Patient requires a Hearing Impaired Relay Service (711)
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.Typography>{"Patient requires a Hearing Impaired Relay Service (711). Patient number is ".concat(patientPhoneNumber, ".")}</material_1.Typography>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ justifyContent: 'flex-end', mr: 3 }}>
        <material_1.Button onClick={onClose} color="primary" variant="contained" size="medium" sx={buttonSx}>
          OK, Got it
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.default = HearingRelayPopup;
//# sourceMappingURL=HearingRelayPopup.js.map