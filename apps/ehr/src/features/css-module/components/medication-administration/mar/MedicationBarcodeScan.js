"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationBarcodeScan = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var BarIcon_1 = require("./BarIcon");
var StyledTypography = (0, material_1.styled)(material_1.Typography)(function (_a) {
    var theme = _a.theme, isScanned = _a.isScanned;
    return (__assign({ display: 'flex', alignItems: 'start', width: 'fit-content' }, (isScanned
        ? {
            color: theme.palette.text.secondary,
            textDecoration: 'none',
        }
        : {
            cursor: 'pointer',
            color: theme.palette.primary.main,
            textDecoration: 'underline',
        })));
});
var MedicationBarcodeScan = function (_a) {
    var medication = _a.medication;
    var theme = (0, material_1.useTheme)();
    var isScanned = true; // medication.scanStatus === 'SCANNED';
    return (<>
      <StyledTypography isScanned={isScanned} sx={{ alignItems: 'center' }}>
        <BarIcon_1.BarIcon sx={{
            width: '24px',
            height: '24px',
            marginRight: theme.spacing(1.5),
            flexShrink: 0,
        }}/>
        {medication.medicationName}
      </StyledTypography>
      {/* {medication.scanStatus && (
          <Box mt={1}>
            <ScanStatusChip medication={medication} />
          </Box>
        )} */}
    </>);
};
exports.MedicationBarcodeScan = MedicationBarcodeScan;
//# sourceMappingURL=MedicationBarcodeScan.js.map