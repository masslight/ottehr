"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropdownPlaceholder = void 0;
var material_1 = require("@mui/material");
var DropdownPlaceholder = function () {
    return (<material_1.Box sx={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            px: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'action.hover',
            position: 'relative',
            overflow: 'hidden',
        }}>
      <material_1.Box sx={{
            width: '60%',
            height: 16,
            backgroundColor: 'action.selected',
            borderRadius: 0.5,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
                '0%': {
                    opacity: 1,
                },
                '50%': {
                    opacity: 0.4,
                },
                '100%': {
                    opacity: 1,
                },
            },
        }}/>

      <material_1.Box sx={{
            position: 'absolute',
            right: 12,
            width: 20,
            height: 16,
            backgroundColor: 'action.selected',
            borderRadius: 0.5,
            animation: 'pulse 1.5s ease-in-out infinite',
        }}/>
    </material_1.Box>);
};
exports.DropdownPlaceholder = DropdownPlaceholder;
//# sourceMappingURL=DropdownPlaceholder.js.map