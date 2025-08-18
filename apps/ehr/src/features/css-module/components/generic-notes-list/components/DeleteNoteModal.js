"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteNoteModal = void 0;
var CSSModal_1 = require("../../CSSModal");
var DeleteNoteModal = function (_a) {
    var open = _a.open, onClose = _a.onClose, entity = _a.entity, onDelete = _a.onDelete, locales = _a.locales;
    return (<CSSModal_1.CSSModal open={open} handleClose={onClose} entity={entity} handleConfirm={onDelete} title={locales.getDeleteModalTitle(locales.entityLabel)} description={locales.getDeleteModalContent(locales.entityLabel)} closeButtonText={locales.getKeepButtonText()} confirmText={locales.getDeleteButtonText(false)} errorMessage={locales.getErrorMessage('deletion', locales.entityLabel)} getEntityPreviewText={function (note) { return note.text; }}/>);
};
exports.DeleteNoteModal = DeleteNoteModal;
//# sourceMappingURL=DeleteNoteModal.js.map