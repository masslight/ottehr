"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconButtonContained = void 0;
var material_1 = require("@mui/material");
var styles_1 = require("@mui/material/styles");
exports.IconButtonContained = (0, material_1.styled)(material_1.IconButton)(function (_a) {
    var variant = _a.variant;
    var theme = (0, material_1.useTheme)();
    var styles = {
        '& > svg': {
            transition: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
    };
    switch (variant) {
        case 'disabled': {
            styles = __assign(__assign({}, styles), { backgroundColor: theme.palette.primary.contrastText, pointerEvents: 'none', cursor: 'default', '&:hover': {} });
            break;
        }
        case 'error': {
            styles = __assign(__assign({}, styles), { backgroundColor: theme.palette.error.main, '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.error.main, 0.125) } });
            break;
        }
        case 'loading': {
            styles = __assign(__assign({}, styles), { backgroundColor: theme.palette.action.disabled, '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.125) } });
            break;
        }
        case 'primary': {
            styles = __assign(__assign({}, styles), { backgroundColor: theme.palette.primary.main, '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.125) } });
            break;
        }
        case 'primary.lighter': {
            styles = __assign(__assign({}, styles), { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.1), '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.2) } });
            break;
        }
        case 'primary.lightest': {
            styles = __assign(__assign({}, styles), { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.85), '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.75) } });
            break;
        }
        default: {
            styles = __assign(__assign({}, styles), { backgroundColor: theme.palette.primary.main, '&:hover': { backgroundColor: (0, styles_1.lighten)(theme.palette.primary.main, 0.125) } });
            break;
        }
    }
    return __assign({}, styles);
});
//# sourceMappingURL=IconButtonContained.js.map