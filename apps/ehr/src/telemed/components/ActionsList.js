"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionsList = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ActionsList = function (props) {
    var data = props.data, getKey = props.getKey, renderItem = props.renderItem, renderActions = props.renderActions, _a = props.gap, gap = _a === void 0 ? 1 : _a, divider = props.divider, _b = props.alignItems, alignItems = _b === void 0 ? 'center' : _b, itemDataTestId = props.itemDataTestId;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: gap }}>
      {data.map(function (item, index, arr) { return (<material_1.Box key={getKey(item, index)} data-testid={itemDataTestId}>
          <material_1.Box sx={{ display: 'flex', alignItems: alignItems, justifyContent: 'space-between', gap: 2 }}>
            {renderItem(item, index)}
            {renderActions && renderActions(item, index)}
          </material_1.Box>
          {divider && index + 1 !== arr.length && <material_1.Divider sx={{ pt: gap }}/>}
        </material_1.Box>); })}
    </material_1.Box>);
};
exports.ActionsList = ActionsList;
//# sourceMappingURL=ActionsList.js.map