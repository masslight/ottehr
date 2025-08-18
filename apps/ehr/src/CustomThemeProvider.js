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
exports.CustomThemeProvider = void 0;
var defaults = require("@ehrDefaultTheme/index");
var customTheme = require("@ehrTheme/index");
var material_1 = require("@mui/material");
var react_1 = require("react");
var textFonts = ['Rubik', 'sans-serif'];
var headerFonts = ['Rubik', 'sans-serif'];
var typography = {
    fontFamily: textFonts.join(','),
    fontWeightMedium: 500,
    // Headers. Gotta have the "!important" in the fontWeight.
    h1: {
        fontSize: 42,
        fontWeight: '500 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    h2: {
        fontSize: 36,
        fontWeight: '500 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    h3: {
        fontSize: 32,
        fontWeight: '600 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    h4: {
        fontSize: 24,
        fontWeight: '600 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    h5: {
        fontSize: 18,
        fontWeight: '600 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    h6: {
        fontSize: 16,
        fontWeight: '600 !important',
        fontFamily: headerFonts.join(','),
        lineHeight: '140%',
    },
    // Other
    subtitle1: {
        fontSize: 20,
        fontWeight: 500,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    subtitle2: {
        fontSize: 12,
        fontWeight: 500,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    body1: {
        fontSize: 16,
        fontWeight: 400,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    body2: {
        fontSize: 14,
        fontWeight: 400,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    caption: {
        fontSize: 12,
        fontWeight: 400,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    overline: {
        fontSize: 12,
        fontWeight: 400,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
    button: {
        fontSize: 14,
        fontWeight: 500,
        fontFamily: textFonts.join(','),
        lineHeight: '140%',
    },
};
var theme = (0, material_1.createTheme)({
    palette: __assign(__assign({}, defaults.palette), customTheme.palette),
    typography: typography,
});
var CustomThemeProvider = function (_a) {
    var children = _a.children;
    return <material_1.ThemeProvider theme={theme}>{children}</material_1.ThemeProvider>;
};
exports.CustomThemeProvider = CustomThemeProvider;
//# sourceMappingURL=CustomThemeProvider.js.map