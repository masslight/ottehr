"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanStatusChip = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var styled_components_1 = require("styled-components");
var StyledChip = (0, styled_components_1.default)(material_1.Chip)(function () { return ({
    borderRadius: '8px',
    padding: '0 9px',
    margin: 0,
    height: '24px',
    '& .MuiChip-label': {
        padding: 0,
        fontWeight: 'bold',
        fontSize: '0.7rem',
    },
}); });
var scanStatusColors = {
    SCANNED: { bg: '#C8E6C9', text: '#1B5E20' },
    FAILED: { bg: '#FECDD2', text: '#B71C1C' },
};
var ScanStatusChip = function (_a) {
    var status = _a.status;
    if (!status)
        return null;
    var chipColors = scanStatusColors[status] || { bg: '#F5F5F5', text: '#757575' };
    return (<StyledChip label={status} sx={{
            backgroundColor: chipColors.bg,
            color: chipColors.text,
        }}/>);
};
exports.ScanStatusChip = ScanStatusChip;
//# sourceMappingURL=ScanStatusChip.js.map