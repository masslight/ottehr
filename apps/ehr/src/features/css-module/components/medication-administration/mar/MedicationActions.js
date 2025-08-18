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
exports.MedicationActions = void 0;
var icons_material_1 = require("@mui/icons-material");
var Warning_1 = require("@mui/icons-material/Warning");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var CustomDialog_1 = require("../../../../../components/dialogs/CustomDialog");
var useMedicationManagement_1 = require("../../../hooks/useMedicationManagement");
var helpers_1 = require("../../../routing/helpers");
var MedicationActions = function (_a) {
    var medication = _a.medication;
    var theme = (0, material_1.useTheme)();
    var _b = (0, useMedicationManagement_1.useMedicationManagement)(), canEditMedication = _b.canEditMedication, deleteMedication = _b.deleteMedication;
    var _c = (0, react_1.useState)(false), isDeleteDialogOpen = _c[0], setIsDeleteDialogOpen = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var _e = (0, react_1.useState)(false), isDeleting = _e[0], setIsDeleting = _e[1];
    (0, react_1.useEffect)(function () {
        if (error) {
            (0, notistack_1.enqueueSnackbar)(error, { variant: 'error' });
        }
    }, [error]);
    var isEditable = canEditMedication(medication);
    if (!isEditable) {
        return null;
    }
    var handleDeleteClick = function () {
        setIsDeleteDialogOpen(true);
    };
    var handleCloseDeleteDialog = function () {
        setIsDeleteDialogOpen(false);
        setError(null);
    };
    var handleConfirmDelete = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsDeleting(true);
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, deleteMedication(medication.id)];
                case 2:
                    _a.sent();
                    setIsDeleteDialogOpen(false);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error deleting medication:', error_1);
                    setError('An error occurred while deleting the medication. Please try again.');
                    return [3 /*break*/, 4];
                case 4:
                    setIsDeleting(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var dialogTitle = (<material_1.Box display="flex" alignItems="center" color="error.main">
      <Warning_1.default sx={{ mr: 1 }}/>
      <material_1.Typography variant="h4">Delete Medication</material_1.Typography>
    </material_1.Box>);
    var navigateToEditOrder = function () {
        if (!appointmentId) {
            (0, notistack_1.enqueueSnackbar)('navigation error', { variant: 'error' });
            return;
        }
        navigate((0, helpers_1.getEditOrderUrl)(appointmentId, medication.id));
    };
    return (<material_1.Box onClick={function (e) { return e.stopPropagation(); }}>
      <material_1.IconButton size="small" aria-label="edit" onClick={navigateToEditOrder}>
        <icons_material_1.EditOutlined sx={{ color: theme.palette.primary.dark }}/>
      </material_1.IconButton>
      <material_1.IconButton size="small" aria-label="delete" onClick={handleDeleteClick}>
        <icons_material_1.DeleteOutlined sx={{ color: theme.palette.warning.dark }}/>
      </material_1.IconButton>
      <CustomDialog_1.CustomDialog open={isDeleteDialogOpen} handleClose={handleCloseDeleteDialog} title={dialogTitle} description={"Are you sure you want to delete the medication \"".concat(medication.medicationName, "\"?")} closeButtonText="Cancel" closeButton={false} handleConfirm={handleConfirmDelete} confirmText={isDeleting ? 'Deleting...' : 'Delete'} confirmLoading={isDeleting}/>
    </material_1.Box>);
};
exports.MedicationActions = MedicationActions;
//# sourceMappingURL=MedicationActions.js.map