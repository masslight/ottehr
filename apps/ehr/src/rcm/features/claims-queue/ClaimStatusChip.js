"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimStatusChip = void 0;
var material_1 = require("@mui/material");
var mapStatusToDisplay = {
    open: { value: 'Open', color: '#1B5E20', background: '#C8E6C9' },
    locked: { value: 'Locked', color: '#424242', background: '#E6E8EE' },
    'returned-billing': { value: 'Returned (billing)', color: '#E65100', background: '#FFE0B2' },
    'returned-coding': { value: 'Returned (coding)', color: '#E65100', background: '#FFE0B2' },
    sent: { value: 'Sent', color: '#01579B', background: '#B3E5FC' },
    'partly-paid': { value: 'Partly paid', color: '#006064', background: '#B2EBF2' },
    denied: { value: 'Denied', color: '#B71C1C', background: '#FECDD2' },
    'returned-credentialing-hold': { value: 'Returned (cred.hold)', color: '#E65100', background: '#FFE0B2' },
    'credential-hold': { value: 'Credential Hold', color: '#880E4F', background: '#F8BBD0' },
};
var ClaimStatusChip = function (props) {
    var status = props.status;
    return (<material_1.Chip size="small" label={mapStatusToDisplay[status].value} sx={{
            borderRadius: '4px',
            border: 'none',
            background: mapStatusToDisplay[status].background,
            height: 'auto',
            '& .MuiChip-label': {
                display: 'block',
                whiteSpace: 'normal',
                fontWeight: 500,
                fontSize: '12px',
                color: mapStatusToDisplay[status].color,
                textTransform: 'uppercase',
            },
        }} variant="outlined"/>);
};
exports.ClaimStatusChip = ClaimStatusChip;
//# sourceMappingURL=ClaimStatusChip.js.map