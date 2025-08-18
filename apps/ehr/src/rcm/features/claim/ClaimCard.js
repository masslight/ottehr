"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ClaimCard = function (props) {
    var title = props.title, children = props.children, editButton = props.editButton;
    return (<material_1.Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <material_1.Typography variant="h4" color="primary.dark">
          {title}
        </material_1.Typography>
        {editButton}
      </material_1.Box>

      {children}
    </material_1.Card>);
};
exports.ClaimCard = ClaimCard;
//# sourceMappingURL=ClaimCard.js.map