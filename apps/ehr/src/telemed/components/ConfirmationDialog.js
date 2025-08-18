"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmationDialog = void 0;
var material_1 = require("@mui/material");
var RoundedButton_1 = require("../../components/RoundedButton");
var data_test_ids_1 = require("../../constants/data-test-ids");
var InnerStateDialog_1 = require("./InnerStateDialog");
var ConfirmationDialog = function (props) {
    var confirmRequest = function (hideDialog) {
        props.response();
        hideDialog();
    };
    return (<InnerStateDialog_1.InnerStateDialog title={props.title} content={props.description &&
            (typeof props.description === 'string' ? (<material_1.DialogContentText>{props.description}</material_1.DialogContentText>) : (props.description))} actions={function (hideDialog) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return (<material_1.Stack direction={((_a = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _a === void 0 ? void 0 : _a.reverse) ? 'row-reverse' : 'row'} spacing={2}>
          <RoundedButton_1.RoundedButton data-testid={data_test_ids_1.dataTestIds.dialog.proceedButton} onClick={function () { return confirmRequest(hideDialog); }} variant="contained" color={((_c = (_b = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _b === void 0 ? void 0 : _b.proceed) === null || _c === void 0 ? void 0 : _c.color) || 'primary'} disabled={(_e = (_d = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _d === void 0 ? void 0 : _d.proceed) === null || _e === void 0 ? void 0 : _e.disabled}>
            {((_g = (_f = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _f === void 0 ? void 0 : _f.proceed) === null || _g === void 0 ? void 0 : _g.text) || 'Proceed'}
          </RoundedButton_1.RoundedButton>
          <RoundedButton_1.RoundedButton onClick={hideDialog} color={((_j = (_h = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _h === void 0 ? void 0 : _h.back) === null || _j === void 0 ? void 0 : _j.color) || 'primary'}>
            {((_l = (_k = props === null || props === void 0 ? void 0 : props.actionButtons) === null || _k === void 0 ? void 0 : _k.back) === null || _l === void 0 ? void 0 : _l.text) || 'Back'}
          </RoundedButton_1.RoundedButton>
        </material_1.Stack>);
        }} DialogProps={{ maxWidth: 'xs' }}>
      {function (showDialog) { return props.children(showDialog); }}
    </InnerStateDialog_1.InnerStateDialog>);
};
exports.ConfirmationDialog = ConfirmationDialog;
//# sourceMappingURL=ConfirmationDialog.js.map