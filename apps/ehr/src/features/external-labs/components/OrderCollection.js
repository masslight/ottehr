"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.OrderCollection = void 0;
exports.openPdf = openPdf;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_router_dom_1 = require("react-router-dom");
var dialogs_1 = require("src/components/dialogs");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var AOECard_1 = require("./AOECard");
var OrderHistoryCard_1 = require("./OrderHistoryCard");
var OrderInformationCard_1 = require("./OrderInformationCard");
var SampleCollectionInstructionsCard_1 = require("./SampleCollectionInstructionsCard");
function openPdf(url) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            window.open(url, '_blank');
            return [2 /*return*/];
        });
    });
}
var OrderCollection = function (_a) {
    var labOrder = _a.labOrder, _b = _a.showActionButtons, showActionButtons = _b === void 0 ? true : _b, _c = _a.showOrderInfo, showOrderInfo = _c === void 0 ? true : _c, _d = _a.isAOECollapsed, isAOECollapsed = _d === void 0 ? false : _d;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehrZambda;
    // can add a Yup resolver {resolver: yupResolver(definedSchema)} for validation, see PaperworkGroup for example
    var methods = (0, react_hook_form_1.useForm)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    // const currentUser = useEvolveUser();
    var questionnaireData = labOrder === null || labOrder === void 0 ? void 0 : labOrder.questionnaire[0];
    var orderStatus = labOrder.orderStatus;
    var aoe = (0, react_1.useMemo)(function () { return (questionnaireData === null || questionnaireData === void 0 ? void 0 : questionnaireData.questionnaire.item) || []; }, [questionnaireData]);
    var labQuestionnaireResponses = questionnaireData === null || questionnaireData === void 0 ? void 0 : questionnaireData.questionnaireResponseItems;
    var _e = (0, react_1.useState)(false), submitLoading = _e[0], setSubmitLoading = _e[1];
    var _f = (0, react_1.useState)(undefined), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)(undefined), manualSubmitError = _g[0], setManualSubmitError = _g[1];
    var _h = (0, react_1.useState)(false), errorDialogOpen = _h[0], setErrorDialogOpen = _h[1];
    var _j = (0, react_1.useState)({}), specimensData = _j[0], setSpecimensData = _j[1];
    var shouldShowSampleCollectionInstructions = !labOrder.isPSC &&
        (labOrder.orderStatus === utils_1.ExternalLabsStatus.pending || labOrder.orderStatus === utils_1.ExternalLabsStatus.sent);
    var showAOECard = aoe.length > 0;
    var sanitizeFormData = function (data) {
        var sanitizedData = __assign({}, data);
        Object.keys(sanitizedData).forEach(function (item) {
            if (!sanitizedData[item]) {
                delete sanitizedData[item];
                return;
            }
            var question = aoe.find(function (question) { return question.linkId === item; });
            if (question && question.type === 'boolean') {
                if (sanitizedData[item] === 'true') {
                    sanitizedData[item] = true;
                }
                if (sanitizedData[item] === 'false') {
                    sanitizedData[item] = false;
                }
            }
            console.log(sanitizedData[item]);
            if (question && (question.type === 'integer' || question.type === 'decimal')) {
                sanitizedData[item] = Number(sanitizedData[item]);
            }
        });
        return sanitizedData;
    };
    var submitOrder = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sanitizedData, _c, orderPdfUrl, labelPdfUrl;
        var data = _b.data, manualOrder = _b.manualOrder;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setSubmitLoading(true);
                    if (!oystehr) {
                        setError(['Oystehr client is undefined']);
                        setErrorDialogOpen(true);
                        return [2 /*return*/];
                    }
                    sanitizedData = sanitizeFormData(data);
                    return [4 /*yield*/, (0, api_1.submitLabOrder)(oystehr, __assign({ serviceRequestID: labOrder.serviceRequestId, accountNumber: labOrder.accountNumber, manualOrder: manualOrder, data: sanitizedData }, (!labOrder.isPSC && { specimens: specimensData })))];
                case 1:
                    _c = _d.sent(), orderPdfUrl = _c.orderPdfUrl, labelPdfUrl = _c.labelPdfUrl;
                    if (!labelPdfUrl) return [3 /*break*/, 3];
                    return [4 /*yield*/, openPdf(labelPdfUrl)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3: return [4 /*yield*/, openPdf(orderPdfUrl)];
                case 4:
                    _d.sent();
                    setSubmitLoading(false);
                    setError(undefined);
                    navigate("/in-person/".concat(appointmentID, "/external-lab-orders"));
                    console.log("data at submit: ".concat(JSON.stringify(sanitizedData)));
                    return [2 /*return*/];
            }
        });
    }); };
    var handleAutomatedSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var e_1, sdkError, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, submitOrder({ data: data, manualOrder: false })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    sdkError = e_1;
                    console.log('error creating external lab order1', sdkError.code, sdkError.message);
                    errorMessage = [sdkError.message || 'There was an error submitting the lab order'];
                    setError(errorMessage);
                    setErrorDialogOpen(true);
                    setSubmitLoading(false);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleManualSubmit = function () { return __awaiter(void 0, void 0, void 0, function () {
        var data, e_2, sdkError, errorMessages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = methods.getValues();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, submitOrder({ data: data, manualOrder: true })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    sdkError = e_2;
                    console.log('error creating external lab order1', sdkError.code, sdkError.message);
                    errorMessages = [sdkError.message || 'There was an error submitting the lab order'];
                    if (sdkError.message === utils_1.ORDER_SUBMITTED_MESSAGE) {
                        errorMessages.push('please refresh this page');
                    }
                    setManualSubmitError(errorMessages);
                    setSubmitLoading(false);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<react_hook_form_1.FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleAutomatedSubmit)}>
        {showAOECard && (<AOECard_1.AOECard questions={aoe} isReadOnly={orderStatus !== 'pending'} labQuestionnaireResponses={labQuestionnaireResponses} isCollapsed={isAOECollapsed}/>)}

        {shouldShowSampleCollectionInstructions &&
            labOrder.samples.map(function (sample) { return (<material_1.Box sx={{ marginTop: showAOECard ? 2 : 0 }} key={"sample-card-".concat(sample.specimen.id)}>
              <SampleCollectionInstructionsCard_1.SampleCollectionInstructionsCard sample={sample} serviceRequestId={labOrder.serviceRequestId} timezone={labOrder.encounterTimezone} setSpecimenData={function (specimenId, date) {
                    return setSpecimensData(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[specimenId] = { date: date }, _a)));
                    });
                }} printLabelVisible={orderStatus === 'sent'} isDateEditable={orderStatus === 'pending'}/>
            </material_1.Box>); })}

        {showOrderInfo && <OrderInformationCard_1.OrderInformationCard orderPdfUrl={labOrder.orderPdfUrl}/>}

        <material_1.Box sx={{ mt: 2 }}>
          <OrderHistoryCard_1.OrderHistoryCard isPSCPerformed={labOrder.isPSC} orderHistory={labOrder === null || labOrder === void 0 ? void 0 : labOrder.history} timezone={labOrder.encounterTimezone}/>
        </material_1.Box>

        {showActionButtons && (<material_1.Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <react_router_dom_1.Link to={"/in-person/".concat(appointmentID, "/external-lab-orders")}>
              <material_1.Button variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                Back
              </material_1.Button>
            </react_router_dom_1.Link>
            {orderStatus === 'pending' && (<material_1.Stack>
                <lab_1.LoadingButton loading={submitLoading} variant="contained" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }} type="submit">
                  Submit & Print Order{!labOrder.isPSC ? ' and Label' : ''}
                </lab_1.LoadingButton>
              </material_1.Stack>)}
          </material_1.Stack>)}
        <dialogs_1.CustomDialog open={errorDialogOpen} confirmLoading={submitLoading} handleConfirm={function () { return handleManualSubmit(); }} confirmText="Manually submit lab order" handleClose={function () {
            setErrorDialogOpen(false);
            setManualSubmitError(undefined);
        }} title="Error submitting lab order" description={(error === null || error === void 0 ? void 0 : error.join(',')) || 'Error submitting lab order'} error={manualSubmitError === null || manualSubmitError === void 0 ? void 0 : manualSubmitError.join(', ')} closeButtonText="cancel"/>
      </form>
    </react_hook_form_1.FormProvider>);
};
exports.OrderCollection = OrderCollection;
//# sourceMappingURL=OrderCollection.js.map