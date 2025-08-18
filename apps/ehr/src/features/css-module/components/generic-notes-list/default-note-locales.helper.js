"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultNoteLocales = void 0;
exports.defaultNoteLocales = {
    entityLabel: 'note',
    editModalTitle: 'Edit Note',
    editModalPlaceholder: 'Note',
    getAddButtonText: function (isSaving) { return (isSaving ? 'Saving...' : 'Add'); },
    getMoreButtonText: function (isMoreEntitiesShown) { return (isMoreEntitiesShown ? 'See less' : 'See more'); },
    getDeleteModalTitle: function (entityLabel) { return "Delete ".concat(entityLabel); },
    getDeleteModalContent: function (entityLabel) { return "Are you sure you want to permanently delete this ".concat(entityLabel, "?"); },
    getKeepButtonText: function () { return 'Keep'; },
    getDeleteButtonText: function (isDeleting) { return (isDeleting ? 'Deleting...' : 'Delete'); },
    getLeaveButtonText: function () { return 'Leave'; },
    getSaveButtonText: function (isSaving) { return (isSaving ? 'Saving...' : 'Save'); },
    getErrorMessage: function (action, entityLabel) { return "Error during ".concat(entityLabel, " ").concat(action, ". Please try again."); },
    getGenericErrorMessage: function () { return 'An error occurred while saving the information. Please try again.'; },
};
//# sourceMappingURL=default-note-locales.helper.js.map