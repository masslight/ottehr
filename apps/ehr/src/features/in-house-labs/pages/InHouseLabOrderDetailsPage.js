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
exports.InHouseLabTestDetailsPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var DetailPageContainer_1 = require("src/features/common/DetailPageContainer");
var telemed_1 = require("src/telemed");
var utils_1 = require("utils");
var useAppClients_1 = require("../../../hooks/useAppClients");
var CollectSampleView_1 = require("../components/details/CollectSampleView");
var FinalResultView_1 = require("../components/details/FinalResultView");
var PerformTestView_1 = require("../components/details/PerformTestView");
var InHouseLabsBreadcrumbs_1 = require("../components/InHouseLabsBreadcrumbs");
var InHouseLabTestDetailsPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var serviceRequestID = (0, react_router_dom_1.useParams)().serviceRequestID;
    var encounter = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, ['encounter', 'appointment']).encounter;
    var _a = (0, react_1.useState)(utils_1.LoadingState.initial), loadingState = _a[0], setLoadingState = _a[1];
    var _b = (0, react_1.useState)(null), testDetails = _b[0], setTestDetails = _b[1];
    var _c = (0, react_1.useState)(undefined), allTestDetails = _c[0], setAllTestDetails = _c[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    (0, react_1.useEffect)(function () {
        var fetchTestDetails = function () { return __awaiter(void 0, void 0, void 0, function () {
            var testData, specificTestDetail, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!encounter.id || !serviceRequestID) {
                            return [2 /*return*/];
                        }
                        setLoadingState(utils_1.LoadingState.loading);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        if (!oystehrZambda) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, api_1.getInHouseOrders)(oystehrZambda, {
                                searchBy: { field: 'serviceRequestId', value: serviceRequestID },
                            })];
                    case 2:
                        testData = _a.sent();
                        setAllTestDetails(testData);
                        specificTestDetail = testData.find(function (data) { return data.serviceRequestId === serviceRequestID; }) || null;
                        setTestDetails(specificTestDetail);
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        // todo better error handling
                        console.error('Error fetching test details:', error_1);
                        return [3 /*break*/, 5];
                    case 4:
                        setLoadingState(utils_1.LoadingState.loaded);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        if (loadingState === utils_1.LoadingState.initial) {
            void fetchTestDetails();
        }
    }, [oystehrZambda, encounter.id, serviceRequestID, loadingState]);
    var handleBack = function () {
        navigate(-1);
    };
    var handleCollectSampleSubmit = function (updatedData) { return __awaiter(void 0, void 0, void 0, function () {
        var loadingError, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoadingState(utils_1.LoadingState.loading);
                    loadingError = false;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    if (!oystehrZambda || !encounter.id || !serviceRequestID) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, api_1.collectInHouseLabSpecimen)(oystehrZambda, {
                            encounterId: encounter.id,
                            serviceRequestId: serviceRequestID,
                            data: updatedData,
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error submitting test details:', error_2);
                    loadingError = true;
                    return [3 /*break*/, 5];
                case 4:
                    if (loadingError) {
                        setLoadingState(utils_1.LoadingState.loadedWithError);
                    }
                    else {
                        setLoadingState(utils_1.LoadingState.initial);
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (loadingState === utils_1.LoadingState.loading) {
        return (<material_1.Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <material_1.CircularProgress />
      </material_1.Box>);
    }
    if (!testDetails) {
        return (<material_1.Box>
        <material_1.Button variant="outlined" onClick={handleBack} sx={{ mb: 2, borderRadius: '50px', px: 4 }}>
          Back
        </material_1.Button>
        <material_1.Paper sx={{ p: 3, textAlign: 'center' }}>
          <material_1.Typography variant="h6" color="error">
            Test details not found
          </material_1.Typography>
        </material_1.Paper>
      </material_1.Box>);
    }
    var pageName = "".concat(testDetails.testItemName).concat((allTestDetails || []).length > 1 ? ' + Repeat' : '');
    return (<DetailPageContainer_1.default>
      <InHouseLabsBreadcrumbs_1.InHouseLabsBreadcrumbs pageName={pageName}>
        {(function () {
            switch (testDetails.status) {
                case 'ORDERED':
                    return (<CollectSampleView_1.CollectSampleView testDetails={testDetails} onBack={handleBack} onSubmit={handleCollectSampleSubmit}/>);
                case 'COLLECTED':
                    return (<PerformTestView_1.PerformTestView testDetails={testDetails} onBack={handleBack} setLoadingState={setLoadingState}/>);
                case 'FINAL':
                    return <FinalResultView_1.FinalResultView testDetails={allTestDetails} onBack={handleBack}/>;
                default:
                    // temp for debugging
                    return <p>Status could not be parsed: {testDetails.status}</p>;
            }
        })()}
      </InHouseLabsBreadcrumbs_1.InHouseLabsBreadcrumbs>
    </DetailPageContainer_1.default>);
};
exports.InHouseLabTestDetailsPage = InHouseLabTestDetailsPage;
//# sourceMappingURL=InHouseLabOrderDetailsPage.js.map