"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BooleanStateChip = BooleanStateChip;
var material_1 = require("@mui/material");
var react_1 = require("react");
var theme = {
    on: {
        background: {
            primary: '#C8E6C9',
        },
        color: {
            primary: '#1B5E20',
        },
    },
    off: {
        background: {
            primary: '#FECDD2',
        },
        color: {
            primary: '#B71C1C',
        },
    },
};
function BooleanStateChip(_a) {
    var state = _a.state, label = _a.label, dataTestId = _a.dataTestId;
    var colors = state ? theme.on : theme.off;
    return (<material_1.Chip data-testid={dataTestId} size="small" label={label} sx={{
            borderRadius: '4px',
            border: 'none',
            fontWeight: 500,
            fontSize: '12px',
            textTransform: 'uppercase',
            background: colors.background.primary,
            color: colors.color.primary,
            padding: '0 2px',
            height: '18px',
        }} variant="outlined"/>);
}
//# sourceMappingURL=BooleanStateChip.js.map