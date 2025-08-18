"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentifiersRow = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var IdentifiersRow = function (_a) {
    var id = _a.id, loading = _a.loading;
    return (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (<material_1.Skeleton width={300}/>) : (<material_1.Tooltip title={id}>
          <material_1.Typography variant="body2" data-testid={data_test_ids_1.dataTestIds.patientHeader.patientId}>
            PID: {id !== null && id !== void 0 ? id : '?'}
          </material_1.Typography>
        </material_1.Tooltip>)}
    </material_1.Box>);
};
exports.IdentifiersRow = IdentifiersRow;
//# sourceMappingURL=IdentifiersRow.js.map