"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericNoteList = void 0;
var useAppointment_1 = require("../../hooks/useAppointment");
var CSSLoader_1 = require("../CSSLoader");
var EditableNotesList_1 = require("./components/EditableNotesList");
var GenericNoteList = function (_a) {
    var _b, _c;
    var apiConfig = _a.apiConfig, locales = _a.locales, _d = _a.separateEncounterNotes, separateEncounterNotes = _d === void 0 ? true : _d;
    var resources = (0, useAppointment_1.useAppointment)().resources;
    var encounterId = (_b = resources.encounter) === null || _b === void 0 ? void 0 : _b.id;
    var patientId = (_c = resources.patient) === null || _c === void 0 ? void 0 : _c.id;
    if (!encounterId || !patientId)
        return <CSSLoader_1.CSSLoader />;
    return (<EditableNotesList_1.EditableNotesList separateEncounterNotes={separateEncounterNotes} encounterId={encounterId} patientId={patientId} currentEncounterId={encounterId} locales={locales} apiConfig={apiConfig}/>);
};
exports.GenericNoteList = GenericNoteList;
//# sourceMappingURL=GenericNoteList.js.map