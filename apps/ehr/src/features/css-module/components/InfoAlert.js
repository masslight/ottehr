"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfoAlert = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var InfoAlert = function (_a) {
    var text = _a.text, persistent = _a.persistent;
    var _b = (0, react_1.useState)(true), open = _b[0], setOpen = _b[1];
    if (!open) {
        return null;
    }
    return (<material_1.Alert severity="info" onClose={persistent ? undefined : function () { return setOpen(false); }} sx={{
            backgroundColor: '#e6f3fa',
        }}>
      <material_1.Typography color="primary.dark">{text}</material_1.Typography>
    </material_1.Alert>);
};
exports.InfoAlert = InfoAlert;
//# sourceMappingURL=InfoAlert.js.map