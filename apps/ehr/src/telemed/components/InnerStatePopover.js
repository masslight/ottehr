"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerStatePopover = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var InnerStatePopover = function (props) {
    var children = props.children, popoverChildren = props.popoverChildren, popoverProps = props.popoverProps;
    var _a = (0, react_1.useState)(null), anchorEl = _a[0], setAnchorEl = _a[1];
    var handlePopoverOpen = function (event) {
        setAnchorEl(event.currentTarget);
    };
    var handlePopoverClose = function () {
        setAnchorEl(null);
    };
    var open = Boolean(anchorEl);
    return (<>
      {children({ handlePopoverOpen: handlePopoverOpen, handlePopoverClose: handlePopoverClose })}
      <material_1.Popover sx={{
            pointerEvents: 'none',
        }} open={open} anchorEl={anchorEl} anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
        }} transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
        }} onClose={handlePopoverClose} disableRestoreFocus {...popoverProps}>
        {popoverChildren}
      </material_1.Popover>
    </>);
};
exports.InnerStatePopover = InnerStatePopover;
//# sourceMappingURL=InnerStatePopover.js.map