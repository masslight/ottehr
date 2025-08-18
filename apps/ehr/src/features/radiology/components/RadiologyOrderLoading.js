"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyOrderLoading = void 0;
var material_1 = require("@mui/material");
var RadiologyOrderLoading = function () {
    return (<material_1.Box sx={{
            position: 'absolute',
            width: '40px',
            height: '40px',
            top: 'calc(50% + 60px)',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
      <material_1.CircularProgress sx={{ color: 'primary.main' }} size={40} thickness={4}/>
    </material_1.Box>);
};
exports.RadiologyOrderLoading = RadiologyOrderLoading;
//# sourceMappingURL=RadiologyOrderLoading.js.map