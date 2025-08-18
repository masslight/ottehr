"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationNotes = void 0;
var utils_1 = require("utils");
var GenericNoteList_1 = require("../generic-notes-list/GenericNoteList");
var medicationNotesConfig = {
    apiConfig: {
        fieldName: 'notes',
        type: utils_1.NOTE_TYPE.MEDICATION,
        searchParams: {
            _sort: '-_lastUpdated',
            _count: 1000,
            _tag: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.NOTE_TYPE.MEDICATION, "|").concat(utils_1.CSS_NOTE_ID),
        },
    },
    locales: {
        entityLabel: 'medication note',
        editModalTitle: 'Edit Medication Note',
        editModalPlaceholder: 'Medication Note',
        getAddButtonText: function (isSaving) { return (isSaving ? 'Saving...' : 'Add'); },
        getMoreButtonText: function (isMoreEntitiesShown) { return (isMoreEntitiesShown ? 'See less' : 'See more'); },
        getDeleteModalTitle: function (entityLabel) { return "Delete ".concat(entityLabel); },
        getDeleteModalContent: function (entityLabel) { return "Are you sure you want to permanently delete this ".concat(entityLabel, "?"); },
        getKeepButtonText: function () { return 'Keep'; },
        getDeleteButtonText: function (isDeleting) { return (isDeleting ? 'Deleting...' : 'Delete'); },
        getLeaveButtonText: function () { return 'Leave'; },
        getSaveButtonText: function (isSaving) { return (isSaving ? 'Saving...' : 'Save'); },
        getErrorMessage: function (action, entityLabel) {
            return "Error during ".concat(entityLabel, " ").concat(action, ". Please try again.");
        },
        getGenericErrorMessage: function () { return 'An error occurred while saving the note. Please try again.'; },
    },
};
var MedicationNotes = function () { return (<GenericNoteList_1.GenericNoteList apiConfig={medicationNotesConfig.apiConfig} locales={medicationNotesConfig.locales}/>); };
exports.MedicationNotes = MedicationNotes;
//# sourceMappingURL=MedicationNotes.js.map