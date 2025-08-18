"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityIconWithBorder = void 0;
var PriorityHigh_1 = require("@mui/icons-material/PriorityHigh");
var material_1 = require("@mui/material");
var PriorityIconWithBorder = function (_a) {
    var fill = _a.fill;
    return (<material_1.Box style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            border: "1.25px solid ".concat(fill),
            height: '10px',
            width: '10px',
            transform: 'rotate(45deg)',
            marginLeft: '6px',
            borderRadius: '1px',
        }}>
    <PriorityHigh_1.default style={{
            position: 'absolute',
            height: '8px',
            color: fill,
            transform: 'rotate(315deg)',
        }}/>
  </material_1.Box>);
};
exports.PriorityIconWithBorder = PriorityIconWithBorder;
//# sourceMappingURL=PriorityIconWithBorder.js.map