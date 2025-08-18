"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDetails = void 0;
var material_1 = require("@mui/material");
var RoundedButton_1 = require("src/features/css-module/components/RoundedButton");
var utils_1 = require("utils");
var NursingOrdersStatusChip_1 = require("../NursingOrdersStatusChip");
var OrderDetails = function (_a) {
    var orderDetails = _a.orderDetails, onSubmit = _a.onSubmit;
    var handleMarkAsCollected = function () {
        onSubmit({
            status: utils_1.NursingOrdersStatus.completed,
        });
    };
    return (<material_1.Box>
      <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <material_1.Typography variant="h4" color="primary.dark" sx={{ fontWeight: 'bold' }}>
          Nursing Order
        </material_1.Typography>
        <NursingOrdersStatusChip_1.NursingOrdersStatusChip status={orderDetails.status}/>
      </material_1.Box>
      <material_1.Paper sx={{ mb: 2 }}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 3 }}>
          <material_1.Typography variant="h6" fontWeight="bold" color="primary.dark">
            Order Note
          </material_1.Typography>
          <material_1.Box>
            <material_1.Typography style={{ whiteSpace: 'pre-line' }}>{orderDetails.note}</material_1.Typography>
          </material_1.Box>
        </material_1.Box>
        {orderDetails.status === utils_1.NursingOrdersStatus.pending && (<>
            <material_1.Divider />
            <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 3 }}>
              <RoundedButton_1.ButtonRounded variant="contained" color="primary" onClick={handleMarkAsCollected} sx={{ borderRadius: '50px', px: 4 }}>
                Mark as Completed
              </RoundedButton_1.ButtonRounded>
            </material_1.Box>
          </>)}
      </material_1.Paper>
    </material_1.Box>);
};
exports.OrderDetails = OrderDetails;
//# sourceMappingURL=OrderDetails.js.map