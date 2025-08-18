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
exports.InHouseLabsNotesCard = void 0;
var material_1 = require("@mui/material");
var InHouseLabsNotesCard = function (_a) {
    var notes = _a.notes, notesLabel = _a.notesLabel, readOnly = _a.readOnly, additionalBoxSxProps = _a.additionalBoxSxProps, additionalTextFieldProps = _a.additionalTextFieldProps, handleNotesUpdate = _a.handleNotesUpdate;
    var sxStyling = !readOnly
        ? {}
        : {
            '& .MuiInputLabel-root': {
                color: '#5F6368',
                '&.Mui-focused': {
                    color: '#5F6368',
                },
            },
            '& .MuiOutlinedInput-root': {
                backgroundColor: '#FFFFFF',
                '& fieldset': {
                    borderColor: '#DADCE0',
                },
                '&:hover fieldset': {
                    borderColor: '#DADCE0',
                },
                '&.Mui-focused fieldset': {
                    borderColor: '#DADCE0',
                    borderWidth: '1px',
                },
                '& .MuiInputBase-input': {
                    fontSize: '0.875rem',
                },
            },
            '& .MuiInputLabel-shrink': {
                backgroundColor: '#FFFFFF',
                px: 1,
            },
        };
    return (<material_1.Box sx={__assign({}, additionalBoxSxProps)}>
      <material_1.TextField {...additionalTextFieldProps} InputProps={{
            readOnly: readOnly,
        }} fullWidth label={notesLabel} value={notes} onChange={function (e) { return handleNotesUpdate === null || handleNotesUpdate === void 0 ? void 0 : handleNotesUpdate(e.target.value); }} variant="outlined" multiline maxRows={4} sx={__assign({}, sxStyling)}/>
    </material_1.Box>);
};
exports.InHouseLabsNotesCard = InHouseLabsNotesCard;
//# sourceMappingURL=InHouseLabsNotesCard.js.map