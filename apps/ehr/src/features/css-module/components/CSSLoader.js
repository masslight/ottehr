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
exports.CSSLoader = void 0;
var material_1 = require("@mui/material");
var CSSLoader = function (props) {
    return (<material_1.Box sx={__assign({ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', maxHeight: '100%' }, props)}>
      {/* disableShrink is needed to correct display loader under heavy CPU load */}
      <material_1.CircularProgress disableShrink size={props.size || 40}/>
    </material_1.Box>);
};
exports.CSSLoader = CSSLoader;
//# sourceMappingURL=CSSLoader.js.map