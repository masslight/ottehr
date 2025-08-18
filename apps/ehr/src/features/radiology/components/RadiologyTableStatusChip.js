"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyTableStatusChip = void 0;
var material_1 = require("@mui/material");
var RadiologyTableStatusChip = function (_a) {
    var status = _a.status;
    return (<material_1.Chip label={status.toUpperCase()} size="small" sx={{
            backgroundColor: getStatusColor(status),
            borderRadius: '4px',
            fontWeight: 'bold',
        }}/>);
};
exports.RadiologyTableStatusChip = RadiologyTableStatusChip;
var getStatusColor = function (status) {
    switch (status) {
        case 'pending':
            return '#E0E0E0';
        case 'performed':
            return '#90CAF9';
        case 'preliminary':
            return '#A5D6A7';
        case 'final':
            return '#CE93D8';
        case 'reviewed':
            return '#81C784';
        default:
            return '#E0E0E0';
    }
};
//# sourceMappingURL=RadiologyTableStatusChip.js.map