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
exports.IntakeNote = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var useIntakeNotes_1 = require("../hooks/useIntakeNotes");
var RoundedButton_1 = require("./RoundedButton");
var icon = (<svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.167 17.5c-.459 0-.851-.163-1.177-.49a1.605 1.605 0 0 1-.49-1.177V4.167c0-.459.163-.851.49-1.177.326-.327.718-.49 1.177-.49h11.666c.459 0 .851.163 1.177.49.327.326.49.718.49 1.177V9.75a6.82 6.82 0 0 0-.813-.323 5.085 5.085 0 0 0-.854-.198V4.167H4.167v11.666h5.041c.042.306.108.598.198.875.09.278.198.542.323.792H4.167Zm0-1.667V4.167v5.062-.062 6.666Zm1.666-1.666H9.23c.042-.292.108-.577.198-.854.09-.278.191-.55.302-.813H5.833v1.667Zm0-3.334h5.084c.444-.416.94-.764 1.49-1.041a5.869 5.869 0 0 1 1.76-.563v-.062H5.833v1.666Zm0-3.333h8.334V5.833H5.833V7.5ZM15 19.167c-1.153 0-2.135-.407-2.948-1.22-.812-.812-1.219-1.794-1.219-2.947s.407-2.135 1.22-2.948c.812-.812 1.794-1.219 2.947-1.219s2.135.407 2.948 1.22c.812.812 1.219 1.794 1.219 2.947s-.407 2.135-1.22 2.948c-.812.812-1.794 1.219-2.947 1.219Zm-.417-1.667h.834v-2.083H17.5v-.834h-2.083V12.5h-.834v2.083H12.5v.834h2.083V17.5Z" fill="#2169F5"/>
  </svg>);
var IntakeNote = function (_a) {
    var open = _a.open, _b = _a.sx, sx = _b === void 0 ? {} : _b;
    var _c = (0, useIntakeNotes_1.useIntakeNotesModal)(), isOpen = _c.isOpen, openModal = _c.openModal, IntakeNotesModal = _c.IntakeNotesModal, closeModal = _c.closeModal;
    return (<>
      {open ? (<RoundedButton_1.ButtonRounded variant="outlined" startIcon={icon} onClick={openModal} sx={__assign({}, sx)}>
          Intake Note
        </RoundedButton_1.ButtonRounded>) : (<material_1.IconButton sx={{
                padding: 0,
                margin: 2,
            }} onClick={openModal}>
          {icon}
        </material_1.IconButton>)}
      <IntakeNotesModal open={isOpen} onClose={closeModal}/>
    </>);
};
exports.IntakeNote = IntakeNote;
//# sourceMappingURL=IntakeNotes.js.map