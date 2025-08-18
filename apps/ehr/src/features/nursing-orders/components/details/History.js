"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.History = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var NursingOrdersStatusChip_1 = require("../NursingOrdersStatusChip");
var formatDateTime = function (dateString) {
    try {
        return luxon_1.DateTime.fromISO(dateString).toFormat("MM/dd/yyyy 'at' h:mm a");
    }
    catch (_a) {
        return dateString;
    }
};
var History = function (_a) {
    var orderHistory = _a.orderHistory;
    return (<material_1.Box>
      {orderHistory.map(function (item) { return (<material_1.Box key={item.status}>
          <material_1.Grid container sx={{ px: 2, py: 1.5 }}>
            <material_1.Grid item xs={3}>
              <NursingOrdersStatusChip_1.NursingOrdersStatusChip status={item.status}/>
            </material_1.Grid>
            <material_1.Grid item xs={4}>
              <material_1.Typography variant="body2">{item.performer}</material_1.Typography>
            </material_1.Grid>
            <material_1.Grid item xs={5}>
              <material_1.Typography variant="body2">{formatDateTime(item.date)}</material_1.Typography>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.Box>); })}
    </material_1.Box>);
};
exports.History = History;
//# sourceMappingURL=History.js.map