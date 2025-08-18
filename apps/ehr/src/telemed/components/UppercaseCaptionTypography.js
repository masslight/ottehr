"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UppercaseCaptionTypography = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
exports.UppercaseCaptionTypography = (0, material_1.styled)(function (props) { return (<material_1.Typography variant="subtitle2" {...props}/>); })(function (_a) {
    var theme = _a.theme;
    return ({
        textTransform: 'uppercase',
        color: theme.palette.primary.dark,
    });
});
//# sourceMappingURL=UppercaseCaptionTypography.js.map