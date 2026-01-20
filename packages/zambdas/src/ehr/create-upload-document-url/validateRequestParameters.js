"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), patientId = _a.patientId, fileFolderId = _a.fileFolderId, fileName = _a.fileName;
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    return {
        secrets: input.secrets,
        patientId: patientId,
        fileFolderId: fileFolderId,
        fileName: fileName,
        userToken: userToken,
    };
}
