"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleColumnContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var DoubleColumnContainer = function (props) {
    var leftColumn = props.leftColumn, rightColumn = props.rightColumn, divider = props.divider, padding = props.padding;
    return (<material_1.Grid container sx={{ position: 'relative' }}>
      <material_1.Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {leftColumn}
      </material_1.Grid>
      {divider && (<material_1.Divider orientation="vertical" flexItem sx={{ position: 'absolute', height: '100%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}/>)}
      <material_1.Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {rightColumn}
      </material_1.Grid>
    </material_1.Grid>);
};
exports.DoubleColumnContainer = DoubleColumnContainer;
//# sourceMappingURL=DoubleColumnContainer.js.map