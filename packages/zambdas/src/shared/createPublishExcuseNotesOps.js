"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublishExcuseNotesOps = createPublishExcuseNotesOps;
var utils_1 = require("utils");
var pdf_utils_1 = require("./pdf/pdf-utils");
function createPublishExcuseNotesOps(documentReferences) {
    var resultBatchRequests = [];
    var workNoteDR;
    var schoolNoteDR;
    documentReferences.forEach(function (item) {
        var _a, _b;
        var workSchoolNoteTag = (_b = (_a = item.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === utils_1.SCHOOL_WORK_NOTE_TYPE_META_SYSTEM; });
        if (workSchoolNoteTag) {
            if (workSchoolNoteTag.code === utils_1.SCHOOL_NOTE_CODE)
                schoolNoteDR = item;
            if (workSchoolNoteTag.code === utils_1.WORK_NOTE_CODE)
                workNoteDR = item;
        }
    });
    if (workNoteDR && !(0, pdf_utils_1.isDocumentPublished)(workNoteDR)) {
        resultBatchRequests.push(pdfPublishedPatchOperation(workNoteDR));
    }
    if (schoolNoteDR && !(0, pdf_utils_1.isDocumentPublished)(schoolNoteDR)) {
        resultBatchRequests.push(pdfPublishedPatchOperation(schoolNoteDR));
    }
    return resultBatchRequests;
}
function pdfPublishedPatchOperation(documentReference) {
    return (0, utils_1.getPatchBinary)({
        resourceType: 'DocumentReference',
        resourceId: documentReference.id,
        patchOperations: [
            (0, utils_1.addOrReplaceOperation)(documentReference.docStatus, '/docStatus', pdf_utils_1.PdfDocumentReferencePublishedStatuses.published),
        ],
    });
}
