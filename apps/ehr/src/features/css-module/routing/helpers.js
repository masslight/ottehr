"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNursingOrderDetailsUrl = exports.getNursingOrderCreateUrl = exports.getNursingOrdersUrl = exports.getInHouseLabOrderDetailsUrl = exports.getInHouseLabOrderCreateUrl = exports.getInHouseLabsUrl = exports.getRadiologyOrderEditUrl = exports.getRadiologyUrl = exports.getExternalLabOrderEditUrl = exports.getExternalLabOrdersUrl = exports.getAssessmentUrl = exports.getInHouseMedicationDetailsUrl = exports.getInHouseMedicationMARUrl = exports.getEditOrderUrl = exports.getNewOrderUrl = void 0;
var getNewOrderUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/in-house-medication/order/new");
};
exports.getNewOrderUrl = getNewOrderUrl;
var getEditOrderUrl = function (appointmentId, orderId) {
    return "/in-person/".concat(appointmentId, "/in-house-medication/order/edit/").concat(orderId);
};
exports.getEditOrderUrl = getEditOrderUrl;
var getInHouseMedicationMARUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/in-house-medication/mar");
};
exports.getInHouseMedicationMARUrl = getInHouseMedicationMARUrl;
var getInHouseMedicationDetailsUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/in-house-medication/medication-details");
};
exports.getInHouseMedicationDetailsUrl = getInHouseMedicationDetailsUrl;
var getAssessmentUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/assessment");
};
exports.getAssessmentUrl = getAssessmentUrl;
var getExternalLabOrdersUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/external-lab-orders/");
};
exports.getExternalLabOrdersUrl = getExternalLabOrdersUrl;
var getExternalLabOrderEditUrl = function (appointmentId, orderId) {
    return "/in-person/".concat(appointmentId, "/external-lab-orders/").concat(orderId, "/order-details");
};
exports.getExternalLabOrderEditUrl = getExternalLabOrderEditUrl;
var getRadiologyUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/radiology");
};
exports.getRadiologyUrl = getRadiologyUrl;
var getRadiologyOrderEditUrl = function (appointmentId, orderId) {
    return "/in-person/".concat(appointmentId, "/radiology/").concat(orderId, "/order-details");
};
exports.getRadiologyOrderEditUrl = getRadiologyOrderEditUrl;
var getInHouseLabsUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/in-house-lab-orders");
};
exports.getInHouseLabsUrl = getInHouseLabsUrl;
var getInHouseLabOrderCreateUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/in-house-lab-orders/create");
};
exports.getInHouseLabOrderCreateUrl = getInHouseLabOrderCreateUrl;
var getInHouseLabOrderDetailsUrl = function (appointmentId, serviceRequestId) {
    return "/in-person/".concat(appointmentId, "/in-house-lab-orders/").concat(serviceRequestId, "/order-details");
};
exports.getInHouseLabOrderDetailsUrl = getInHouseLabOrderDetailsUrl;
var getNursingOrdersUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/nursing-orders");
};
exports.getNursingOrdersUrl = getNursingOrdersUrl;
var getNursingOrderCreateUrl = function (appointmentId) {
    return "/in-person/".concat(appointmentId, "/nursing-orders/create");
};
exports.getNursingOrderCreateUrl = getNursingOrderCreateUrl;
var getNursingOrderDetailsUrl = function (appointmentId, serviceRequestId) {
    return "/in-person/".concat(appointmentId, "/nursing-orders/").concat(serviceRequestId, "/order-details");
};
exports.getNursingOrderDetailsUrl = getNursingOrderDetailsUrl;
//# sourceMappingURL=helpers.js.map