"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskMedicationsAlert = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var AskMedicationsAlert = function () {
    var _a = (0, react_1.useState)(true), open = _a[0], setOpen = _a[1];
    return (<material_1.Collapse in={open}>
      <material_1.Alert severity="info" action={<material_1.IconButton color="inherit" size="small" onClick={function () { return setOpen(false); }}>
            <Close_1.default fontSize="inherit"/>
          </material_1.IconButton>} sx={{
            backgroundColor: '#e6f3fa',
        }}>
        <material_1.Typography color="primary.dark">
          Ask: Has the patient taken any medication in the last 24 hours? Are there any medications that they take every
          day?
        </material_1.Typography>
      </material_1.Alert>
    </material_1.Collapse>);
};
exports.AskMedicationsAlert = AskMedicationsAlert;
//# sourceMappingURL=AskMedicationsAlert.js.map