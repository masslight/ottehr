"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CPTCodesContainer = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var CPTCodesContainer = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var cptCodes = chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        CPT codes
      </material_1.Typography>
      {cptCodes === null || cptCodes === void 0 ? void 0 : cptCodes.map(function (code) { return (<material_1.Typography key={code.resourceId}>
          {code.code} {code.display}
        </material_1.Typography>); })}
    </material_1.Box>);
};
exports.CPTCodesContainer = CPTCodesContainer;
//# sourceMappingURL=CPTCodesContainer.js.map