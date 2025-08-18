"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteVitalModal = void 0;
var CSSModal_1 = require("../CSSModal");
var DeleteVitalModal = function (_a) {
    var open = _a.open, onClose = _a.onClose, entity = _a.entity, onDelete = _a.onDelete;
    return (<CSSModal_1.CSSModal open={open} handleClose={onClose} entity={entity} handleConfirm={onDelete} title="Delete vital" description="Are you sure you want to permanently delete this vitals note?" closeButtonText="Keep" confirmText="Delete" errorMessage="Can't delete vital observation. Please try again later." showEntityPreview={false}/>);
};
exports.DeleteVitalModal = DeleteVitalModal;
//# sourceMappingURL=DeleteVitalModal.js.map