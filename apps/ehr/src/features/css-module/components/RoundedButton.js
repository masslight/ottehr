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
exports.ButtonRounded = void 0;
var material_1 = require("@mui/material");
exports.ButtonRounded = (0, material_1.styled)(material_1.Button)(function (_a) {
    var theme = _a.theme, variant = _a.variant, _b = _a.size, size = _b === void 0 ? 'medium' : _b;
    return (__assign(__assign(__assign(__assign({ margin: 2, borderRadius: '18px', textTransform: 'none', boxShadow: 'none', padding: '6px 16px', minWidth: 'auto', width: 'auto' }, (size === 'medium' && {
        height: '36px',
        fontSize: '0.875rem',
    })), (size === 'large' && {
        height: '42px',
        fontSize: '1rem',
        padding: '6px 32px',
        fontWeight: 900,
        borderRadius: '28px',
    })), (variant === 'outlined' && {
        backgroundColor: 'white',
        color: theme.palette.primary.main,
        border: "1px solid ".concat(theme.palette.primary.main),
        '&:hover': {
            backgroundColor: 'rgba(77, 21, 183, 0.04)',
            borderColor: theme.palette.primary.dark,
        },
    })), (variant === 'contained' && {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        border: 'none',
        '&:hover': {
            backgroundColor: theme.palette.primary.dark,
        },
    })));
});
//# sourceMappingURL=RoundedButton.js.map