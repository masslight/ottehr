"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderSideListSkeleton = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var components_1 = require("../../../components");
var ProviderSideListSkeleton = function () {
    return (<>
      {[1, 2, 3].map(function (medication, index, arr) { return (<material_1.Box key={medication} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton}>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <material_1.Skeleton width="100%">
              <material_1.Typography>{medication}</material_1.Typography>
            </material_1.Skeleton>
            <material_1.Skeleton variant="circular">
              <components_1.DeleteIconButton />
            </material_1.Skeleton>
          </material_1.Box>
          {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
        </material_1.Box>); })}
    </>);
};
exports.ProviderSideListSkeleton = ProviderSideListSkeleton;
//# sourceMappingURL=ProviderSideListSkeleton.js.map