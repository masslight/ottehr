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
exports.AllergiesNotes = void 0;
var utils_1 = require("utils");
var default_note_locales_helper_1 = require("../generic-notes-list/default-note-locales.helper");
var GenericNoteList_1 = require("../generic-notes-list/GenericNoteList");
var allergiesNotesConfig = {
    apiConfig: {
        fieldName: 'notes',
        type: utils_1.NOTE_TYPE.ALLERGY,
        searchParams: {
            _sort: '-_lastUpdated',
            _count: 1000,
            _tag: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.NOTE_TYPE.ALLERGY, "|").concat(utils_1.CSS_NOTE_ID),
        },
    },
    locales: __assign(__assign({}, default_note_locales_helper_1.defaultNoteLocales), { entityLabel: 'allergy note', editModalTitle: 'Edit Allergy Note', editModalPlaceholder: 'Allergy Note' }),
};
var AllergiesNotes = function () { return (<GenericNoteList_1.GenericNoteList apiConfig={allergiesNotesConfig.apiConfig} locales={allergiesNotesConfig.locales}/>); };
exports.AllergiesNotes = AllergiesNotes;
//# sourceMappingURL=AllergiesNotes.js.map