"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientSideListSkeleton = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var PatientSideListSkeleton = function () {
    return (<>
      {[1, 2, 3].map(function (answer, index, arr) { return (<material_1.Box key={index}>
          <material_1.Skeleton width="100%">
            <material_1.Typography>{answer}</material_1.Typography>
          </material_1.Skeleton>
          {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
        </material_1.Box>); })}
    </>);
};
exports.PatientSideListSkeleton = PatientSideListSkeleton;
//# sourceMappingURL=PatientSideListSkeleton.js.map