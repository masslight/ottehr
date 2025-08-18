"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteConfiguration = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var CompleteConfiguration = function (_a) {
    var handleSetup = _a.handleSetup;
    return (<material_1.Box sx={{
            backgroundColor: colors_1.otherColors.orange100,
            px: '20px',
            py: '10px',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
        }}>
      <material_1.Typography variant="body1">
        <span style={{ fontWeight: 'bold' }}>Complete configuration</span>
        <br />
        Functionality might be limited. Please follow the guide to setup and enable the feature.
      </material_1.Typography>
      <material_1.Button sx={{
            backgroundColor: colors_1.otherColors.orange800,
            color: '#FFFFFF',
            borderRadius: '100px',
            textTransform: 'none',
            '&:hover': {
                backgroundColor: colors_1.otherColors.orange700,
            },
        }} onClick={function () { return handleSetup(); }}>
        Setup
      </material_1.Button>
    </material_1.Box>);
};
exports.CompleteConfiguration = CompleteConfiguration;
//# sourceMappingURL=CompleteConfiguration.js.map