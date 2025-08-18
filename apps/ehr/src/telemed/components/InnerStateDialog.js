"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerStateDialog = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var InnerStateDialog = function (props) {
    var children = props.children, title = props.title, actions = props.actions, content = props.content, DialogProps = props.DialogProps, showCloseButton = props.showCloseButton;
    var _a = (0, react_1.useState)(false), open = _a[0], setOpen = _a[1];
    var showDialog = function () {
        setOpen(true);
    };
    var hideDialog = function () {
        setOpen(false);
    };
    return (<>
      {children(showDialog)}
      {open && (<material_1.Dialog fullWidth {...DialogProps} open={open} onClose={hideDialog}>
          {showCloseButton && (<material_1.IconButton onClick={hideDialog} size="small" sx={{
                    position: 'absolute',
                    right: 16,
                    top: 16,
                }}>
              <Close_1.default fontSize="small"/>
            </material_1.IconButton>)}

          {title ? (typeof title === 'string' ? (<material_1.DialogTitle component={material_1.Typography} variant="h5" color="primary.dark" sx={{ pb: 1 }}>
                {title}
              </material_1.DialogTitle>) : (title)) : null}

          {content && <material_1.DialogContent sx={{ pb: 2 }}>{content}</material_1.DialogContent>}

          {actions && (<material_1.DialogActions sx={{ p: 3 }}>{typeof actions === 'function' ? actions(hideDialog) : actions}</material_1.DialogActions>)}
        </material_1.Dialog>)}
    </>);
};
exports.InnerStateDialog = InnerStateDialog;
//# sourceMappingURL=InnerStateDialog.js.map