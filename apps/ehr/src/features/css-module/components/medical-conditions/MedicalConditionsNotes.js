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
exports.MedicalConditionsNotes = void 0;
var utils_1 = require("utils");
var default_note_locales_helper_1 = require("../generic-notes-list/default-note-locales.helper");
var GenericNoteList_1 = require("../generic-notes-list/GenericNoteList");
var medicalConditionsNotesConfig = {
    apiConfig: {
        fieldName: 'notes',
        type: utils_1.NOTE_TYPE.MEDICAL_CONDITION,
        searchParams: {
            _sort: '-_lastUpdated',
            _count: 1000,
            _tag: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.NOTE_TYPE.MEDICAL_CONDITION, "|").concat(utils_1.CSS_NOTE_ID),
        },
    },
    locales: __assign(__assign({}, default_note_locales_helper_1.defaultNoteLocales), { entityLabel: 'medical condition note', editModalTitle: 'Edit Medical Condition Note', editModalPlaceholder: 'Medical Condition Note' }),
};
var MedicalConditionsNotes = function () { return (<GenericNoteList_1.GenericNoteList apiConfig={medicalConditionsNotesConfig.apiConfig} locales={medicalConditionsNotesConfig.locales}/>); };
exports.MedicalConditionsNotes = MedicalConditionsNotes;
//# sourceMappingURL=MedicalConditionsNotes.js.map