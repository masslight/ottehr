"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMCodeContainer = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var EMCodeContainer = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        E&M code
      </material_1.Typography>
      <material_1.Typography>{emCode === null || emCode === void 0 ? void 0 : emCode.display}</material_1.Typography>
    </material_1.Box>);
};
exports.EMCodeContainer = EMCodeContainer;
//# sourceMappingURL=EMCodeContainer.js.map