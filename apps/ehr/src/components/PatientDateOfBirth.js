"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDateOfBirth = void 0;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var utils_1 = require("utils");
var formatDateTime_1 = require("../helpers/formatDateTime");
var PatientDateOfBirth = function (_a) {
    var dateOfBirth = _a.dateOfBirth;
    var theme = (0, system_1.useTheme)();
    return (<system_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
      <material_1.Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
        {"DOB: ".concat((0, formatDateTime_1.formatDateUsingSlashes)(dateOfBirth), " (").concat((0, utils_1.calculatePatientAge)(dateOfBirth), ")")}
      </material_1.Typography>
    </system_1.Box>);
};
exports.PatientDateOfBirth = PatientDateOfBirth;
//# sourceMappingURL=PatientDateOfBirth.js.map