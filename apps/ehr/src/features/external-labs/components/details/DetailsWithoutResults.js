"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetailsWithoutResults = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var PageTitle_1 = require("../../../../telemed/components/PageTitle");
var ExternalLabsStatusChip_1 = require("../ExternalLabsStatusChip");
var OrderCollection_1 = require("../OrderCollection");
var DetailsWithoutResults = function (_a) {
    var labOrder = _a.labOrder;
    return (<material_1.Stack spacing={2} sx={{ width: '100%' }}>
      <PageTitle_1.CSSPageTitle>{labOrder.testItem}</PageTitle_1.CSSPageTitle>
      <material_1.Stack direction="row" spacing={2} sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
        <material_1.Typography variant="body1" width="100%">
          {labOrder.diagnoses}
        </material_1.Typography>
        <material_1.Grid container justifyContent="end" spacing={2}>
          <material_1.Grid item sx={{ display: 'flex', alignItems: 'center' }}>
            <material_1.Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mr: 1 }}>
              {labOrder.isPSC ? utils_1.PSC_LOCALE : ''}
            </material_1.Typography>
          </material_1.Grid>
          <material_1.Grid item>
            <ExternalLabsStatusChip_1.LabsOrderStatusChip status={labOrder.orderStatus}/>
          </material_1.Grid>
        </material_1.Grid>
      </material_1.Stack>
      {/* {taskStatus === 'pending' && (
            <TaskBanner
              orderName={labOrder.testItem}
              orderingPhysician={labOrder.orderingPhysician}
              orderedOnDate={labOrder.orderAddedDate}
              labName={labOrder?.fillerLab}
              taskStatus={taskStatus}
            />
          )} */}
      <OrderCollection_1.OrderCollection labOrder={labOrder} showOrderInfo={labOrder.orderStatus.includes('sent')}/>
    </material_1.Stack>);
};
exports.DetailsWithoutResults = DetailsWithoutResults;
//# sourceMappingURL=DetailsWithoutResults.js.map