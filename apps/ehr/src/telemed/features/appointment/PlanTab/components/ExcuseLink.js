"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcuseLink = void 0;
var colors_1 = require("@ehrTheme/colors");
var InsertDriveFileOutlined_1 = require("@mui/icons-material/InsertDriveFileOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var components_1 = require("../../../../components");
var ExcuseLink = function (props) {
    var label = props.label, to = props.to, onDelete = props.onDelete, disabled = props.disabled;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Card elevation={0} sx={{
            py: 1,
            px: 2,
            backgroundColor: colors_1.otherColors.apptHover,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            color: theme.palette.primary.main,
            width: '100%',
            textDecoration: 'none',
        }} component={react_router_dom_1.Link} to={to} target="_blank">
      <InsertDriveFileOutlined_1.default fontSize="small"/>
      <material_1.Typography sx={{ flexGrow: 1 }} fontWeight={500}>
        {label}
      </material_1.Typography>
      {onDelete && (<components_1.DeleteIconButton onClick={function (e) {
                e.preventDefault();
                onDelete();
            }} disabled={disabled}/>)}
    </material_1.Card>);
};
exports.ExcuseLink = ExcuseLink;
//# sourceMappingURL=ExcuseLink.js.map