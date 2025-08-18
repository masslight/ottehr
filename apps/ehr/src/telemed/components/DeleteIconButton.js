"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteIconButton = void 0;
var colors_1 = require("@ehrTheme/colors");
var DeleteOutlined_1 = require("@mui/icons-material/DeleteOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var DeleteIconButton = function (props) {
    var onClick = props.onClick, disabled = props.disabled, size = props.size, fontSize = props.fontSize, dataTestId = props.dataTestId;
    return (<material_1.IconButton data-testid={dataTestId} sx={{ color: colors_1.otherColors.endCallButton }} size={size || 'small'} disabled={disabled} onClick={onClick}>
      <DeleteOutlined_1.default fontSize={fontSize || 'small'}/>
    </material_1.IconButton>);
};
exports.DeleteIconButton = DeleteIconButton;
//# sourceMappingURL=DeleteIconButton.js.map