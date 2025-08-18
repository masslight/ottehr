"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersToolTip = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var OrdersToolTip = function (_a) {
    var orderConfigs = _a.orderConfigs;
    return (<material_1.Stack sx={{
            width: '380px',
            padding: '16px',
            maxHeight: '420px',
            overflowY: 'scroll',
            '&::-webkit-scrollbar': {
                width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#ccc',
                borderRadius: '4px',
                paddingY: '30px',
            },
        }} spacing={1} divider={<material_1.Divider orientation="horizontal"/>}>
      {orderConfigs.map(function (config) { return (<material_1.Stack spacing={1} key={"tooltip-orders-container-".concat(config.title)}>
          <material_1.Box display="flex" alignItems="center">
            <material_1.Box sx={{
                width: '32px',
                height: '32px',
                backgroundColor: '#E3F2FD',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
            }}>
              {config.icon}
            </material_1.Box>
            <material_1.Box>
              <material_1.Typography variant="body2" sx={{ fontWeight: '500 !important' }}>
                {config.title}
              </material_1.Typography>
              <material_1.Typography variant="caption">
                {config.orders.length} order{config.orders.length > 1 ? 's' : ''}
              </material_1.Typography>
            </material_1.Box>
          </material_1.Box>
          {config.orders.map(function (order) { return (<react_router_dom_1.Link key={"tooltip-test-item".concat(order.fhirResourceId)} to={order.detailPageUrl} style={{ textDecoration: 'none' }}>
              <material_1.Box display="flex" alignItems="center" gap="8px" color="text.primary">
                <material_1.Typography variant="body2">{order.itemDescription}</material_1.Typography>
                {order.statusChip}
              </material_1.Box>
            </react_router_dom_1.Link>); })}
        </material_1.Stack>); })}
    </material_1.Stack>);
};
exports.OrdersToolTip = OrdersToolTip;
//# sourceMappingURL=OrdersToolTip.js.map