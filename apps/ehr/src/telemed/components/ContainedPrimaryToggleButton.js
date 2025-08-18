"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainedPrimaryToggleButton = void 0;
var material_1 = require("@mui/material");
exports.ContainedPrimaryToggleButton = (0, material_1.styled)(material_1.ToggleButton)(function (_a) {
    var theme = _a.theme;
    return ({
        color: theme.palette.primary.main,
        borderColor: theme.palette.primary.main,
        textTransform: 'none',
        padding: '6px 16px',
        fontWeight: 500,
        transition: 'background .25s, color .25s',
        '&.Mui-selected': {
            color: 'white',
            backgroundColor: theme.palette.primary.main,
        },
        '&.Mui-selected:hover': {
            backgroundColor: theme.palette.primary.dark,
        },
    });
});
//# sourceMappingURL=ContainedPrimaryToggleButton.js.map