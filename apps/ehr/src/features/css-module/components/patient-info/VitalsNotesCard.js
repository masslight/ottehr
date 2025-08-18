"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("utils");
var GenericNoteList_1 = require("../generic-notes-list/GenericNoteList");
var vitalsNotesConfig = {
    apiConfig: {
        fieldName: 'notes',
        type: utils_1.NOTE_TYPE.VITALS,
        searchParams: {
            _sort: '-_lastUpdated',
            _count: 1000,
            _tag: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.NOTE_TYPE.VITALS, "|").concat(utils_1.CSS_NOTE_ID),
        },
    },
    locales: {
        entityLabel: 'vitals note',
        editModalTitle: 'Edit Vitals Note',
        editModalPlaceholder: 'Vitals Note',
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
        getGenericErrorMessage: function () { return 'An error occurred while saving the information. Please try again.'; },
    },
};
var VitalsNotesCard = function () { return (<GenericNoteList_1.GenericNoteList apiConfig={vitalsNotesConfig.apiConfig} locales={vitalsNotesConfig.locales}/>); };
exports.default = VitalsNotesCard;
//# sourceMappingURL=VitalsNotesCard.js.map