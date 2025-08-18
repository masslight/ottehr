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
exports.SectionList = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var SectionList = function (_a) {
    var sections = _a.sections, sx = _a.sx;
    return (<material_1.Box sx={__assign({ display: 'flex', flexDirection: 'column', gap: 1 }, sx)}>
      {sections.map(function (section, index) { return (<react_1.Fragment key={index}>
          {section}
          {index < sections.length - 1 && <material_1.Divider orientation="horizontal" flexItem/>}
        </react_1.Fragment>); })}
    </material_1.Box>);
};
exports.SectionList = SectionList;
//# sourceMappingURL=SectionList.js.map