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
exports.NursingOrderDetailsPage = void 0;
var ArrowDropDownCircleOutlined_1 = require("@mui/icons-material/ArrowDropDownCircleOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var RoundedButton_1 = require("src/features/css-module/components/RoundedButton");
var BreadCrumbs_1 = require("../components/BreadCrumbs");
var History_1 = require("../components/details/History");
var OrderDetails_1 = require("../components/details/OrderDetails");
var useNursingOrders_1 = require("../components/orders/useNursingOrders");
var NursingOrderDetailsPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var serviceRequestID = (0, react_router_dom_1.useParams)().serviceRequestID;
    var _a = (0, react_1.useState)(true), showHistory = _a[0], setShowHistory = _a[1];
    var _b = (0, useNursingOrders_1.useGetNursingOrders)({
        searchBy: { field: 'serviceRequestId', value: serviceRequestID || '' },
    }), nursingOrders = _b.nursingOrders, loading = _b.loading, error = _b.error;
    var order = nursingOrders.find(function (order) { return order.serviceRequestId === serviceRequestID; });
    var handleBack = function () {
        navigate(-1);
    };
    var handleToggleDetails = function () {
        setShowHistory(!showHistory);
    };
    var updateNursingOrder = (0, useNursingOrders_1.useUpdateNursingOrder)({
        serviceRequestId: serviceRequestID,
        action: 'COMPLETE ORDER',
    }).updateNursingOrder;
    var handleSubmit = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, updateNursingOrder()];
                case 1:
                    _a.sent();
                    // Navigate back to the list view
                    navigate(-1);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error completing nursing order:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<material_1.Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <material_1.CircularProgress />
      </material_1.Box>);
    }
    if (error) {
        return (<material_1.Paper sx={{ mb: 2 }}>
        <material_1.Typography color="error" variant="body1" gutterBottom>
          {'Failed to fetch nursing order details. Please try again later.'}
        </material_1.Typography>
      </material_1.Paper>);
    }
    if (!order) {
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
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '680px', width: '100%' }}>
        <BreadCrumbs_1.BreadCrumbs />

        <OrderDetails_1.OrderDetails orderDetails={order} onSubmit={handleSubmit}/>

        <material_1.Paper>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, backgroundColor: '#F4F6F8' }}>
            <material_1.IconButton onClick={handleToggleDetails} sx={{ mr: 0.75, p: 0 }}>
              <ArrowDropDownCircleOutlined_1.default color="primary" sx={{
            rotate: showHistory ? '' : '180deg',
        }}></ArrowDropDownCircleOutlined_1.default>
            </material_1.IconButton>
            <material_1.Typography variant="subtitle2" color="primary.dark" sx={{ fontSize: '14px' }}>
              Order History
            </material_1.Typography>
          </material_1.Box>
          <material_1.Divider />
          <material_1.Collapse in={showHistory}>
            <History_1.History orderHistory={order.history}/>
          </material_1.Collapse>
        </material_1.Paper>

        <RoundedButton_1.ButtonRounded variant="outlined" onClick={handleBack} sx={{ borderRadius: '50px', px: 4, alignSelf: 'flex-start' }}>
          Back
        </RoundedButton_1.ButtonRounded>
      </material_1.Box>
    </material_1.Box>);
};
exports.NursingOrderDetailsPage = NursingOrderDetailsPage;
//# sourceMappingURL=NursingOrderDetailsPage.js.map