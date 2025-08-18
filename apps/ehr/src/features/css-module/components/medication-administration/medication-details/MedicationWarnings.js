"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationWarnings = void 0;
var Warning_1 = require("@mui/icons-material/Warning");
var material_1 = require("@mui/material");
var styles_1 = require("@mui/material/styles");
var react_1 = require("react");
var useMedicationManagement_1 = require("../../../hooks/useMedicationManagement");
var WarningBox = (0, styles_1.styled)(material_1.Box)(function (_a) {
    var theme = _a.theme;
    return ({
        backgroundColor: '#FFEBEE',
        color: '#D32F2F',
        padding: theme.spacing(1),
        display: 'flex',
        alignItems: 'center',
        marginBottom: theme.spacing(2),
        borderRadius: theme.shape.borderRadius,
    });
});
var MedicationWarnings = function () {
    var warnings = (0, useMedicationManagement_1.useMedicationManagement)().warnings;
    if (warnings.length === 0) {
        return null;
    }
    return (<>
      {warnings.map(function (warning, index) { return (<WarningBox key={index}>
          <Warning_1.default sx={{ marginRight: 1 }}/>
          {typeof warning === 'string' ? <material_1.Typography variant="body2">{warning}</material_1.Typography> : warning}
        </WarningBox>); })}
    </>);
};
exports.MedicationWarnings = MedicationWarnings;
//# sourceMappingURL=MedicationWarnings.js.map