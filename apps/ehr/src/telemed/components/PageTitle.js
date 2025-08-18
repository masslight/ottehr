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
exports.PageTitle = exports.CSSPageTitle = void 0;
var material_1 = require("@mui/material");
var Typography_1 = require("@mui/material/Typography");
var system_1 = require("@mui/system");
var react_1 = require("react");
var IntakeNotes_1 = require("../../features/css-module/components/IntakeNotes");
exports.CSSPageTitle = (0, system_1.styled)(Typography_1.default)(function (_a) {
    var theme = _a.theme;
    return (__assign(__assign({}, (theme === null || theme === void 0 ? void 0 : theme.typography).h4), { textAlign: 'left', color: theme.palette.primary.dark }));
});
var PageTitle = function (_a) {
    var label = _a.label, dataTestId = _a.dataTestId, _b = _a.showIntakeNotesButton, showIntakeNotesButton = _b === void 0 ? true : _b;
    var open = (0, react_1.useState)(true)[0];
    return (<material_1.Grid container sx={{ alignItems: 'center' }} columns={{ xs: 10 }}>
      <material_1.Grid item xs>
        <exports.CSSPageTitle data-testid={dataTestId}>{label}</exports.CSSPageTitle>
      </material_1.Grid>
      {showIntakeNotesButton && (<material_1.Grid item>
          <IntakeNotes_1.IntakeNote open={open}/>
        </material_1.Grid>)}
    </material_1.Grid>);
};
exports.PageTitle = PageTitle;
//# sourceMappingURL=PageTitle.js.map