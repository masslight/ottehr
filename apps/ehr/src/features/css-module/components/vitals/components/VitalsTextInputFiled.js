"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsTextFreeInputField = exports.VitalsTextInputFiled = void 0;
var material_1 = require("@mui/material");
exports.VitalsTextInputFiled = (0, material_1.styled)(function (props) { return (<material_1.TextField variant="outlined" fullWidth autoComplete="off" size="small" error={props.isInputError} helperText={props.isInputError ? 'Invalid value' : ''} FormHelperTextProps={{
        sx: { backgroundColor: '#F7F8F9', mx: 0, fontWeight: 500, fontSize: '14px' },
    }} sx={__assign({ backgroundColor: 'white', '& .MuiOutlinedInput-root': {
            height: '100%',
        }, '& .MuiInputLabel-root': {
            color: 'text.secondary',
        }, '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
            display: 'none',
        }, '& input[type=number]': {
            MozAppearance: 'textfield',
        } }, props.extraSx)} type="number" {...props}/>); })(function () { return ({}); });
exports.VitalsTextFreeInputField = (0, material_1.styled)(function (props) { return (<material_1.TextField variant="outlined" fullWidth autoComplete="off" size="small" error={props.isInputError} helperText={props.isInputError ? 'Invalid value' : ''} FormHelperTextProps={{
        sx: { backgroundColor: '#F7F8F9', mx: 0, fontWeight: 500, fontSize: '14px' },
    }} sx={__assign({ backgroundColor: 'white', '& .MuiOutlinedInput-root': {
            height: '100%',
        }, '& .MuiInputLabel-root': {
            color: 'text.secondary',
        } }, props.extraSx)} type="text" {...props}/>); })(function () { return ({}); });
//# sourceMappingURL=VitalsTextInputFiled.js.map