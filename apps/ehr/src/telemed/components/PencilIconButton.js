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
exports.PencilIconButton = PencilIconButton;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var material_1 = require("@mui/material");
function PencilIconButton(_a) {
    var onClick = _a.onClick, size = _a.size, sx = _a.sx;
    return (<material_1.IconButton sx={__assign({ color: 'primary.main', width: size, height: size }, sx)} onClick={onClick}>
      <EditOutlined_1.default sx={{ width: size, height: size }}/>
    </material_1.IconButton>);
}
//# sourceMappingURL=PencilIconButton.js.map