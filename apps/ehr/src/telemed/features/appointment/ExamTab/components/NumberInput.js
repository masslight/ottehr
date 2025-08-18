"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumberInput = void 0;
var material_1 = require("@mui/material");
exports.NumberInput = (0, material_1.styled)(function (props) { return <material_1.TextField type="number" size="small" {...props}/>; })(function () { return ({
    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
        display: 'none',
    },
    '& input[type=number]': {
        MozAppearance: 'textfield',
    },
    '& .MuiFormHelperText-root.Mui-error': {
        position: 'absolute',
        top: '100%',
        marginTop: 0,
    },
}); });
//# sourceMappingURL=NumberInput.js.map