"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentStatusChip = AppointmentStatusChip;
var material_1 = require("@mui/material");
var utils_1 = require("../utils");
function AppointmentStatusChip(_a) {
    var status = _a.status;
    if (!status) {
        return <span>todo1</span>;
    }
    if (!utils_1.TelemedAppointmentStatusToPalette[status]) {
        return <span>todo2</span>;
    }
    return (<material_1.Chip size="small" label={status} sx={{
            borderRadius: '4px',
            border: 'none',
            fontWeight: 500,
            fontSize: '12px',
            textTransform: 'uppercase',
            background: utils_1.TelemedAppointmentStatusToPalette[status].background.primary,
            color: utils_1.TelemedAppointmentStatusToPalette[status].color.primary,
        }} variant="outlined"/>);
}
//# sourceMappingURL=AppointmentStatusChip.js.map