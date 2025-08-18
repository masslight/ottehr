"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditModal = void 0;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var telemed_1 = require("../../../../../telemed");
var EditModal = function (props) {
    var children = props.children, onSave = props.onSave, title = props.title, customDialogButton = props.customDialogButton, isSaveLoading = props.isSaveLoading, onShow = props.onShow, maxWidth = props.maxWidth;
    return (<telemed_1.InnerStateDialog showCloseButton DialogProps={{ maxWidth: maxWidth || 'lg', PaperProps: { sx: { p: 2, pt: 3 } } }} title={<material_1.DialogTitle component={material_1.Typography} variant="h4" color="primary.dark" sx={{ pb: 0 }}>
          {title}
        </material_1.DialogTitle>} actions={function (hideDialog) { return (<material_1.Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <lab_1.LoadingButton onClick={function () { return onSave(hideDialog); }} loading={isSaveLoading} variant="contained" sx={{
                fontWeight: 500,
                borderRadius: '100px',
                mr: '8px',
                textTransform: 'none',
            }}>
            Save changes
          </lab_1.LoadingButton>
          <RoundedButton_1.RoundedButton variant="text" onClick={hideDialog}>
            Cancel
          </RoundedButton_1.RoundedButton>
        </material_1.Box>); }} content={<material_1.Box sx={{ pt: 3 }}>{children}</material_1.Box>}>
      {function (showDialog) {
            return customDialogButton ? (customDialogButton(showDialog)) : (<material_1.IconButton color="primary" size="small" onClick={function () {
                    onShow === null || onShow === void 0 ? void 0 : onShow();
                    showDialog();
                }}>
            <EditOutlined_1.default />
          </material_1.IconButton>);
        }}
    </telemed_1.InnerStateDialog>);
};
exports.EditModal = EditModal;
//# sourceMappingURL=EditModal.js.map