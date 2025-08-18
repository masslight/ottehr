"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimListCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ClaimCard_1 = require("./ClaimCard");
var ClaimListCard = function (props) {
    var title = props.title, items = props.items, comment = props.comment, editButton = props.editButton;
    var length = (0, react_1.useMemo)(function () { return items.length; }, [items]);
    return (<ClaimCard_1.ClaimCard title={title} editButton={editButton}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(function (item, index) { return (<react_1.Fragment key={item.label}>
            <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
              <material_1.Typography color="primary.dark">{item.label}</material_1.Typography>
              {!item.hideValue && <material_1.Typography textAlign="end">{item.value || '-'}</material_1.Typography>}
            </material_1.Box>
            {(!!comment || length - 1 > index) && <material_1.Divider flexItem/>}
          </react_1.Fragment>); })}
        {comment && <material_1.Typography color="primary.dark">{comment}</material_1.Typography>}
      </material_1.Box>
    </ClaimCard_1.ClaimCard>);
};
exports.ClaimListCard = ClaimListCard;
//# sourceMappingURL=ClaimListCard.js.map