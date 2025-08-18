"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntakeNotes = exports.useIntakeNotesModal = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var GenericNoteList_1 = require("../components/generic-notes-list/GenericNoteList");
var useIntakeNotesModal = function () {
    var _a = react_1.default.useState(false), isOpen = _a[0], setIsOpen = _a[1];
    var openModal = function () { return setIsOpen(true); };
    var closeModal = function () { return setIsOpen(false); };
    return {
        isOpen: isOpen,
        openModal: openModal,
        closeModal: closeModal,
        IntakeNotesModal: IntakeNotesModal,
    };
};
exports.useIntakeNotesModal = useIntakeNotesModal;
var IntakeNotesModal = function (_a) {
    var open = _a.open, onClose = _a.onClose;
    return (<material_1.Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <material_1.DialogTitle>
        <material_1.Box px={3} display="flex" alignItems="center" justifyContent="space-between">
          <material_1.Typography variant="h4" component="div">
            Intake Notes
          </material_1.Typography>
          <material_1.IconButton sx={{ color: 'grey.500' }} edge="end" color="inherit" onClick={onClose} aria-label="close">
            <Close_1.default />
          </material_1.IconButton>
        </material_1.Box>
      </material_1.DialogTitle>

      <material_1.DialogContent sx={{ mt: -3 }}>
        <exports.IntakeNotes />
      </material_1.DialogContent>
    </material_1.Dialog>);
};
var intakeNotesConfig = {
    apiConfig: {
        fieldName: 'notes',
        type: utils_1.NOTE_TYPE.INTAKE,
        searchParams: {
            _search_by: 'encounter',
            _sort: '-_lastUpdated',
            _count: 1000,
            _tag: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.NOTE_TYPE.INTAKE, "|").concat(utils_1.CSS_NOTE_ID),
        },
    },
    locales: {
        entityLabel: 'intake note',
        editModalTitle: 'Edit Intake Note',
        editModalPlaceholder: 'Intake Note',
        getAddButtonText: function (isSaving) { return (isSaving ? 'Saving Intake Note...' : 'Save Intake Note'); },
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
var IntakeNotes = function () { return (<GenericNoteList_1.GenericNoteList separateEncounterNotes={false} apiConfig={intakeNotesConfig.apiConfig} locales={intakeNotesConfig.locales}/>); };
exports.IntakeNotes = IntakeNotes;
//# sourceMappingURL=useIntakeNotes.js.map