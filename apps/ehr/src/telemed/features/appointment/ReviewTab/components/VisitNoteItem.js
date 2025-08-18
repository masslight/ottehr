"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitNoteItem = void 0;
var material_1 = require("@mui/material");
var VisitNoteItem = function (props) {
    var label = props.label, value = props.value, noMaxWidth = props.noMaxWidth;
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: noMaxWidth ? 'auto' : '550px' }}>
      <material_1.Typography color="primary.dark">{label}</material_1.Typography>
      <material_1.Typography>{value}</material_1.Typography>
    </material_1.Box>);
};
exports.VisitNoteItem = VisitNoteItem;
//# sourceMappingURL=VisitNoteItem.js.map