"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapResourcesToExternalLabOrders = exports.mapResourcesToInHouseLabOrders = void 0;
var utils_1 = require("utils");
var helpers_1 = require("../../../ehr/get-in-house-orders/helpers");
var helpers_2 = require("../../../ehr/get-lab-orders/helpers");
var mapResourcesToInHouseLabOrders = function (serviceRequests, activityDefinitions, observations) {
    return serviceRequests
        .filter(function (sr) { return sr.id; })
        .map(function (serviceRequest) {
        var activityDefinition = (0, helpers_1.findActivityDefinitionForServiceRequest)(serviceRequest, activityDefinitions);
        if (!activityDefinition) {
            console.warn("ActivityDefinition not found for ServiceRequest ".concat(serviceRequest.id));
            return null;
        }
        var testItem = (0, utils_1.convertActivityDefinitionToTestItem)(activityDefinition, observations, serviceRequest);
        return {
            serviceRequestId: serviceRequest.id,
            testItemName: testItem.name,
        };
    })
        .filter(Boolean);
};
exports.mapResourcesToInHouseLabOrders = mapResourcesToInHouseLabOrders;
var mapResourcesToExternalLabOrders = function (serviceRequests) {
    return serviceRequests.map(function (serviceRequest) {
        var _a;
        var testItem = (0, helpers_2.parseLabInfo)(serviceRequest).testItem;
        return {
            serviceRequestId: (_a = serviceRequest.id) !== null && _a !== void 0 ? _a : '',
            testItemName: testItem,
        };
    });
};
exports.mapResourcesToExternalLabOrders = mapResourcesToExternalLabOrders;
