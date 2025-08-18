"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabOrderLoading = void 0;
var material_1 = require("@mui/material");
var LabOrderLoading = function () {
    return (<material_1.Box sx={{
            position: 'absolute',
            width: '40px',
            height: '40px',
            top: 'calc(50% + 60px)',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'transparent',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
      <material_1.CircularProgress sx={{ color: 'primary.main' }} size={40} thickness={4}/>
    </material_1.Box>);
};
exports.LabOrderLoading = LabOrderLoading;
//# sourceMappingURL=LabOrderLoading.js.map