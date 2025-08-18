"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNoteHandlers = void 0;
var useChartData_1 = require("../../../hooks/useChartData");
var useDeleteNote_1 = require("./useDeleteNote");
var useEditNote_1 = require("./useEditNote");
var useSaveNote_1 = require("./useSaveNote");
var useNoteHandlers = function (_a) {
    var _b;
    var encounterId = _a.encounterId, patientId = _a.patientId, apiConfig = _a.apiConfig, locales = _a.locales;
    var _c = (0, useChartData_1.useChartData)({
        encounterId: encounterId,
        requestedFields: (_b = {}, _b[apiConfig.fieldName] = apiConfig.searchParams, _b),
    }), chartData = _c.chartData, isLoading = _c.isLoading;
    var entities = ((chartData === null || chartData === void 0 ? void 0 : chartData[apiConfig.fieldName]) || []).map(function (note) { return ({
        resourceId: note.resourceId,
        text: note.text,
        authorId: note.authorId,
        authorName: note.authorName,
        lastUpdated: note.lastUpdated,
        encounterId: note.encounterId,
        patientId: note.patientId,
        type: note.type,
    }); });
    var handleSave = (0, useSaveNote_1.useSaveNote)({ encounterId: encounterId, patientId: patientId, apiConfig: apiConfig });
    var handleEdit = (0, useEditNote_1.useEditNote)({ encounterId: encounterId, apiConfig: apiConfig });
    var handleDelete = (0, useDeleteNote_1.useDeleteNote)({ encounterId: encounterId, apiConfig: apiConfig, locales: locales });
    return {
        entities: entities,
        isLoading: isLoading,
        handleSave: handleSave,
        handleEdit: handleEdit,
        handleDelete: handleDelete,
    };
};
exports.useNoteHandlers = useNoteHandlers;
//# sourceMappingURL=useNoteHandlers.js.map