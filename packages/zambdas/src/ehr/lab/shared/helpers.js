"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSoftDeleteStatusPatchRequest = void 0;
var makeSoftDeleteStatusPatchRequest = function (resourceType, id) {
    var getStatus = function (resourceType) {
        switch (resourceType) {
            case 'Communication':
            case 'DiagnosticReport':
            case 'DocumentReference':
            case 'QuestionnaireResponse':
            case 'Specimen':
                return 'entered-in-error';
            case 'ServiceRequest':
                return 'revoked';
            case 'Task':
                return 'cancelled';
            default:
                throw new Error("cannot determine soft delete status for unrecognized resourceType: ".concat(resourceType));
        }
    };
    return {
        method: 'PATCH',
        url: "".concat(resourceType, "/").concat(id),
        operations: [
            {
                op: 'replace',
                path: '/status',
                value: getStatus(resourceType),
            },
        ],
    };
};
exports.makeSoftDeleteStatusPatchRequest = makeSoftDeleteStatusPatchRequest;
