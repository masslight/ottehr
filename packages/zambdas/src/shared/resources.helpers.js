"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveOrUpdateResourceRequest = saveOrUpdateResourceRequest;
exports.saveResourceRequest = saveResourceRequest;
exports.updateResourceRequest = updateResourceRequest;
exports.parseCreatedResourcesBundle = parseCreatedResourcesBundle;
function saveOrUpdateResourceRequest(resource) {
    return resource.id === undefined ? saveResourceRequest(resource) : updateResourceRequest(resource);
}
function saveResourceRequest(resource, fullUrl) {
    return {
        method: 'POST',
        url: "/".concat(resource.resourceType),
        resource: resource,
        fullUrl: fullUrl,
    };
}
function updateResourceRequest(resource) {
    return {
        method: 'PUT',
        url: "/".concat(resource.resourceType, "/").concat(resource.id),
        resource: resource,
    };
}
function parseCreatedResourcesBundle(bundle) {
    var _a;
    var entries = (_a = bundle.entry) !== null && _a !== void 0 ? _a : [];
    return entries.filter(function (entry) { return entry.resource !== undefined; }).map(function (entry) { return entry.resource; });
}
