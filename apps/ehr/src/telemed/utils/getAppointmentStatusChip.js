"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentStatusChip = getAppointmentStatusChip;
var material_1 = require("@mui/material");
var react_1 = require("react");
var data_test_ids_1 = require("../../constants/data-test-ids");
var appointments_1 = require("./appointments");
function getAppointmentStatusChip(status, item) {
    var count = typeof item === 'number' ? item : undefined;
    var mapper = typeof item === 'object' ? item : appointments_1.APPT_STATUS_MAP;
    if (!status) {
        return <span>todo1</span>;
    }
    if (!mapper[status]) {
        return <span>todo2</span>;
    }
    // to swap color and background if background is white
    var isBackgroundWhite = /^#(f{3}|f{6})$/i.test(mapper[status].background.primary);
    return (<material_1.Chip size="small" label={count ? "".concat(status, " - ").concat(count) : status} sx={{
            borderRadius: '4px',
            border: 'none',
            fontWeight: 500,
            textTransform: 'uppercase',
            background: mapper[status][isBackgroundWhite ? 'color' : 'background'].primary,
            color: mapper[status][isBackgroundWhite ? 'background' : 'color'].primary,
        }} variant="outlined" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip}/>);
}
//# sourceMappingURL=getAppointmentStatusChip.js.map