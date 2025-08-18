"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsStatusChipsCount = void 0;
var material_1 = require("@mui/material");
var helpers_1 = require("../helpers");
var AppointmentTableRow_1 = require("./AppointmentTableRow");
var ORDER_STATUS = [
    'pending',
    'arrived',
    'ready',
    'intake',
    'ready for provider',
    'provider',
    'discharged',
    'checked out',
    'canceled',
    'no show',
    'left not seen',
    'unknown',
];
var AppointmentsStatusChipsCount = function (_a) {
    var appointments = _a.appointments;
    var statusCounts = (0, helpers_1.classifyAppointments)(appointments);
    return (<material_1.Box sx={{ display: 'flex', gap: 2, padding: 2, paddingLeft: 0, flexWrap: 'wrap' }}>
      {Array.from(statusCounts)
            .sort(function (_a, _b) {
            var statusOne = _a[0], _countOne = _a[1];
            var statusTwo = _b[0], _countTwo = _b[1];
            return ORDER_STATUS.indexOf(statusOne) - ORDER_STATUS.indexOf(statusTwo);
        })
            .map(function (_a) {
            var status = _a[0], count = _a[1];
            return (<material_1.Box key={status}>{(0, AppointmentTableRow_1.getAppointmentStatusChip)(status, count)}</material_1.Box>);
        })}
    </material_1.Box>);
};
exports.AppointmentsStatusChipsCount = AppointmentsStatusChipsCount;
//# sourceMappingURL=AppointmentStatusChipsCount.js.map