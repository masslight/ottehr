"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performEffect = exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var discharge_summary_pdf_1 = require("../../shared/pdf/discharge-summary-pdf");
var make_discharge_summary_document_reference_1 = require("../../shared/pdf/make-discharge-summary-document-reference");
var get_video_resources_1 = require("../../shared/pdf/visit-details-pdf/get-video-resources");
var get_chart_data_1 = require("../get-chart-data");
var helpers_1 = require("../get-in-house-orders/helpers");
var helpers_2 = require("../get-lab-orders/helpers");
var get_medication_orders_1 = require("../get-medication-orders");
var order_list_1 = require("../radiology/order-list");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('create-discharge-summary', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentId, timezone, secrets, oystehr, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("create-discharge-summary started, input: ".concat(JSON.stringify(input)));
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({
                                message: "Invalid request parameters. ".concat(error.message || error),
                            }),
                        }];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                appointmentId = validatedParameters.appointmentId, timezone = validatedParameters.timezone, secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, appointmentId, secrets, timezone)];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-discharge-summary', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (oystehr, appointmentId, secrets, timezone) { return __awaiter(void 0, void 0, void 0, function () {
    var visitResources, encounter, patient, listResources, chartDataPromise, additionalChartDataPromise, radiologyOrdersPromise, externalLabOrdersPromise, inHouseOrdersPromise, medicationOrdersPromise, _a, chartDataResult, additionalChartDataResult, radiologyData, externalLabsData, inHouseOrdersData, medicationOrdersData, chartData, additionalChartData, medicationOrders, _b, pdfInfo, attached, documentReference, dischargeSummaryDocumentId;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId, true)];
            case 1:
                visitResources = _d.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                if (timezone) {
                    // if the timezone is provided, it will be taken as the tz to use here rather than the location's schedule
                    // this allows the provider to specify their working location in the case of virtual encounters
                    visitResources.timezone = timezone;
                }
                encounter = visitResources.encounter, patient = visitResources.patient, listResources = visitResources.listResources;
                chartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, m2mToken, encounter.id);
                additionalChartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, m2mToken, encounter.id, utils_1.progressNoteChartDataRequestedFields);
                radiologyOrdersPromise = (0, order_list_1.getRadiologyOrders)(oystehr, {
                    encounterIds: [encounter.id],
                });
                externalLabOrdersPromise = (0, helpers_2.getLabResources)(oystehr, {
                    searchBy: { field: 'encounterId', value: encounter.id },
                    itemsPerPage: 10,
                    pageIndex: 0,
                    secrets: secrets,
                }, m2mToken, { searchBy: { field: 'encounterId', value: encounter.id } });
                inHouseOrdersPromise = (0, helpers_1.getInHouseResources)(oystehr, {
                    searchBy: { field: 'encounterId', value: encounter.id },
                    itemsPerPage: 10,
                    pageIndex: 0,
                    secrets: secrets,
                    userToken: '',
                }, { searchBy: { field: 'encounterId', value: encounter.id } }, m2mToken);
                medicationOrdersPromise = (0, get_medication_orders_1.getMedicationOrders)(oystehr, {
                    searchBy: {
                        field: 'encounterId',
                        value: encounter.id,
                    },
                });
                return [4 /*yield*/, Promise.all([
                        chartDataPromise,
                        additionalChartDataPromise,
                        radiologyOrdersPromise,
                        externalLabOrdersPromise,
                        inHouseOrdersPromise,
                        medicationOrdersPromise,
                    ])];
            case 2:
                _a = _d.sent(), chartDataResult = _a[0], additionalChartDataResult = _a[1], radiologyData = _a[2], externalLabsData = _a[3], inHouseOrdersData = _a[4], medicationOrdersData = _a[5];
                chartData = chartDataResult.response;
                additionalChartData = additionalChartDataResult.response;
                medicationOrders = medicationOrdersData === null || medicationOrdersData === void 0 ? void 0 : medicationOrdersData.orders.filter(function (order) { return order.status !== 'cancelled'; });
                console.log('Chart data received');
                return [4 /*yield*/, (0, discharge_summary_pdf_1.composeAndCreateDischargeSummaryPdf)({
                        chartData: chartData,
                        additionalChartData: additionalChartData,
                        radiologyData: radiologyData,
                        externalLabsData: externalLabsData,
                        inHouseOrdersData: inHouseOrdersData,
                        medicationOrders: medicationOrders,
                    }, visitResources, secrets, m2mToken)];
            case 3:
                _b = _d.sent(), pdfInfo = _b.pdfInfo, attached = _b.attached;
                if (!(patient === null || patient === void 0 ? void 0 : patient.id))
                    throw new Error("No patient has been found for encounter: ".concat(encounter.id));
                console.log("Creating discharge summary pdf Document Reference");
                return [4 /*yield*/, (0, make_discharge_summary_document_reference_1.makeDischargeSummaryPdfDocumentReference)(oystehr, pdfInfo, patient.id, appointmentId, encounter.id, listResources, attached)];
            case 4:
                documentReference = _d.sent();
                dischargeSummaryDocumentId = (_c = documentReference.id) !== null && _c !== void 0 ? _c : '';
                return [2 /*return*/, {
                        message: 'Discharge Summary created.',
                        documentId: dischargeSummaryDocumentId,
                    }];
        }
    });
}); };
exports.performEffect = performEffect;
