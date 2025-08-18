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
exports.RadiologyOrderDetailsPage = void 0;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var useAppClients_1 = require("src/hooks/useAppClients");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var mui_radiology_svg_1 = require("../../../themes/ottehr/icons/mui-radiology.svg");
var RadiologyBreadcrumbs_1 = require("../components/RadiologyBreadcrumbs");
var RadiologyOrderHistoryCard_1 = require("../components/RadiologyOrderHistoryCard");
var RadiologyOrderLoading_1 = require("../components/RadiologyOrderLoading");
var RadiologyTableStatusChip_1 = require("../components/RadiologyTableStatusChip");
var usePatientRadiologyOrders_1 = require("../components/usePatientRadiologyOrders");
var RadiologyOrderDetailsPage = function () {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var urlParams = (0, react_router_dom_1.useParams)();
    var serviceRequestId = urlParams.serviceRequestID;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, system_1.useTheme)();
    var _a = (0, react_1.useState)(false), isLaunchingViewer = _a[0], setIsLaunchingViewer = _a[1];
    var _b = (0, react_1.useState)(null), launchViewerError = _b[0], setLaunchViewerError = _b[1];
    var _c = (0, usePatientRadiologyOrders_1.usePatientRadiologyOrders)({
        serviceRequestId: serviceRequestId,
    }), orders = _c.orders, loading = _c.loading;
    var handleBack = function () {
        navigate(-1);
    };
    var handleViewImageClick = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLaunchingViewer(true);
                    setLaunchViewerError(null);
                    if (!oystehrZambda) {
                        console.error('oystehrZambda is not defined');
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, api_1.radiologyLaunchViewer)(oystehrZambda, {
                            serviceRequestId: serviceRequestId,
                        })];
                case 2:
                    response = _a.sent();
                    if (response) {
                        window.open(response.url, '_blank');
                    }
                    else {
                        setLaunchViewerError('Could not launch viewer');
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error('Error launching viewer:', err_1);
                    setLaunchViewerError('An error occurred launching the viewer');
                    return [3 /*break*/, 5];
                case 4:
                    setIsLaunchingViewer(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [serviceRequestId, oystehrZambda]);
    var order = orders.find(function (order) { return order.serviceRequestId === serviceRequestId; });
    if (loading || !order) {
        return <RadiologyOrderLoading_1.RadiologyOrderLoading />;
    }
    return (<RadiologyBreadcrumbs_1.WithRadiologyBreadcrumbs sectionName={order.studyType}>
      <div style={{ maxWidth: '714px', margin: '0 auto' }}>
        <system_1.Stack spacing={2} sx={{ p: 3 }}>
          {order.isStat ? (<material_1.Chip size="small" label="STAT" sx={{
                borderRadius: '4px',
                border: 'none',
                fontWeight: 900,
                fontSize: '14px',
                textTransform: 'uppercase',
                background: theme.palette.error.main,
                color: 'white',
                padding: '8px',
                height: '24px',
                width: 'fit-content',
            }} variant="outlined"/>) : null}
          <PageTitle_1.CSSPageTitle>{"Radiology: ".concat(order.studyType)}</PageTitle_1.CSSPageTitle>

          <system_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
        }}>
            <system_1.Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexDirection: 'row',
            fontWeight: 'bold',
        }}>
              <material_1.Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {order.diagnosis}
              </material_1.Typography>
            </system_1.Box>
            <system_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'row' }}>
              <RadiologyTableStatusChip_1.RadiologyTableStatusChip status={order.status}/>
            </system_1.Box>
          </system_1.Box>

          <system_1.Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
            <system_1.Box sx={{ padding: 2 }}>
              <material_1.Button variant="outlined" startIcon={<system_1.Box sx={{
                fill: 'gray',
            }} component="img" src={mui_radiology_svg_1.default} style={{ width: '30px', marginRight: '8px' }}/>} endIcon={isLaunchingViewer ? <material_1.CircularProgress size={16} color="inherit"/> : null} onClick={function () { return handleViewImageClick(); }} sx={{ borderRadius: '50px', textTransform: 'none' }} disabled={order.status === 'pending' || isLaunchingViewer}>
                {isLaunchingViewer ? 'Launching Image...' : 'View Image'}
              </material_1.Button>

              {launchViewerError && (<system_1.Box sx={{ mt: 2, color: 'error.main' }}>
                  <material_1.Typography color="error">{launchViewerError}</material_1.Typography>
                </system_1.Box>)}

              {order.clinicalHistory && (<system_1.Box sx={{ mt: 2 }}>
                  <material_1.Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Clinical History
                  </material_1.Typography>
                  <material_1.Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {order.clinicalHistory}
                  </material_1.Typography>
                </system_1.Box>)}

              {order.result != null ? (<system_1.Box sx={{ mt: 2 }}>
                  <material_1.Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Report
                  </material_1.Typography>
                  <material_1.Typography variant="body2">
                    <div dangerouslySetInnerHTML={{ __html: atob(order.result) }}/>
                  </material_1.Typography>
                </system_1.Box>) : (<div />)}
            </system_1.Box>
          </system_1.Box>

          <RadiologyOrderHistoryCard_1.RadiologyOrderHistoryCard orderHistory={order.history}/>

          <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: 28,
            padding: '8px 22px',
            alignSelf: 'flex-start',
            marginTop: 2,
            textTransform: 'none',
        }} onClick={handleBack}>
            Back
          </material_1.Button>
        </system_1.Stack>
      </div>
    </RadiologyBreadcrumbs_1.WithRadiologyBreadcrumbs>);
};
exports.RadiologyOrderDetailsPage = RadiologyOrderDetailsPage;
//# sourceMappingURL=RadiologyOrderDetails.js.map