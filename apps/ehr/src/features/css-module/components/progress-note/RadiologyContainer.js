"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyContainer = void 0;
var material_1 = require("@mui/material");
var Image_1 = require("@mui/icons-material/Image");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var usePatientRadiologyOrders_1 = require("../../../radiology/components/usePatientRadiologyOrders");
var RadiologyContainer = function () {
    var encounter = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['encounter']).encounter;
    var theme = (0, material_1.useTheme)();
    var _a = (0, usePatientRadiologyOrders_1.usePatientRadiologyOrders)({
        encounterIds: encounter.id,
    }), orders = _a.orders, loading = _a.loading;
    var renderProperty = function (label, value) {
        if (value == null || value === '') {
            return undefined;
        }
        return (<material_1.Box>
        <material_1.Typography component="span" sx={{ fontWeight: '500' }}>
          {label}:
        </material_1.Typography>{' '}
        {value}
      </material_1.Box>);
    };
    var renderRadiologyOrder = function (order) {
        return (<material_1.Stack key={order.serviceRequestId} spacing={1} sx={{ mb: 2 }}>
        <material_1.Typography sx={{ color: '#0F347C', fontWeight: '500' }}>
          {order.studyType}
        </material_1.Typography>
        {renderProperty('Diagnosis', order.diagnosis)}
        {renderProperty('Clinical History', order.clinicalHistory)}
        {order.history && order.history.length > 0 && (<>
            {order.history
                    .filter(function (h) { return h.status === 'preliminary'; })
                    .map(function (h, idx) { return (<material_1.Box key={"preliminary-".concat(idx)}>
                  <material_1.Typography component="span" sx={{ fontWeight: '500' }}>
                    Preliminary Read:
                  </material_1.Typography>{' '}
                  {order.result || 'See AdvaPACS'}
                </material_1.Box>); })}
            {order.history
                    .filter(function (h) { return h.status === 'final'; })
                    .map(function (h, idx) { return (<material_1.Box key={"final-".concat(idx)}>
                  <material_1.Typography component="span" sx={{ fontWeight: '500' }}>
                    Final Read:
                  </material_1.Typography>{' '}
                  {order.result || 'See AdvaPACS'}
                </material_1.Box>); })}
          </>)}
        {renderProperty('Result', order.result)}
        {order.result && (<material_1.Link href="#" sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    '&:hover': {
                        textDecoration: 'underline',
                    },
                }}>
            <Image_1.default fontSize="small"/>
            View Image
          </material_1.Link>)}
      </material_1.Stack>);
    };
    if (loading) {
        return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
        <material_1.Typography variant="h5" color="primary.dark">
          Radiology
        </material_1.Typography>
        <material_1.Typography>Loading...</material_1.Typography>
      </material_1.Box>);
    }
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Radiology
      </material_1.Typography>
      {(orders === null || orders === void 0 ? void 0 : orders.length) ? (orders.map(renderRadiologyOrder)) : (<material_1.Typography color={theme.palette.text.secondary}>No radiology orders</material_1.Typography>)}
    </material_1.Box>);
};
exports.RadiologyContainer = RadiologyContainer;
//# sourceMappingURL=RadiologyContainer.js.map