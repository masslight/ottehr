"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatchBinary = getPatchBinary;
function getPatchBinary(input) {
    var resourceId = input.resourceId, resourceType = input.resourceType, patchOperations = input.patchOperations;
    return {
        method: 'PATCH',
        url: "/".concat(resourceType, "/").concat(resourceId),
        resource: {
            resourceType: 'Binary',
            data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
            contentType: 'application/json-patch+json',
        },
    };
}
//# sourceMappingURL=fhir.js.map