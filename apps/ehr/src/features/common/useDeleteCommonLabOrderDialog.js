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
exports.useDeleteCommonLabOrderDialog = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var defaultLocalesConstants = {
    noLabOrderSelectedForDeletion: 'No lab order selected for deletion',
    failedToDeleteLabOrder: 'Failed to delete lab order',
    errorOccurredDuringDeletion: 'An error occurred during deletion',
    errorConfirmingDelete: 'Error confirming delete:',
    deleteOrderDialogTitle: 'Delete Lab Order',
    deleteOrderDialogContent: function (testItemName) { return (<>
      Are you sure you want to delete this order <strong>{testItemName}</strong>?
      <br />
      <br />
      Deleting this order will also remove any additional associated diagnoses.
    </>); },
    deleteOrderDialogKeepButton: 'Keep',
    deleteOrderDialogDeleteButton: 'Delete Order',
    deleteOrderDialogDeletingButton: 'Deleting Order...',
};
var useDeleteCommonLabOrderDialog = function (_a) {
    var deleteOrder = _a.deleteOrder, _b = _a.locales, locales = _b === void 0 ? defaultLocalesConstants : _b;
    var _c = (0, react_1.useState)(false), isDeleteDialogOpen = _c[0], setIsDeleteDialogOpen = _c[1];
    var _d = (0, react_1.useState)(false), isDeleting = _d[0], setIsDeleting = _d[1];
    var _e = (0, react_1.useState)(null), deleteError = _e[0], setDeleteError = _e[1];
    var _f = (0, react_1.useState)(''), serviceRequestIdToDelete = _f[0], setServiceRequestIdToDelete = _f[1];
    var _g = (0, react_1.useState)(''), testItemNameToDelete = _g[0], setTestItemNameToDelete = _g[1];
    var showDeleteLabOrderDialog = (0, react_1.useCallback)(function (_a) {
        var serviceRequestId = _a.serviceRequestId, testItemName = _a.testItemName;
        setServiceRequestIdToDelete(serviceRequestId);
        setTestItemNameToDelete(testItemName);
        setIsDeleteDialogOpen(true);
        setDeleteError(null);
    }, []);
    var closeDeleteDialog = (0, react_1.useCallback)(function () {
        setIsDeleteDialogOpen(false);
        setDeleteError(null);
    }, []);
    var confirmDeleteOrder = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var success, err_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!serviceRequestIdToDelete) {
                        setDeleteError(locales.noLabOrderSelectedForDeletion);
                        return [2 /*return*/];
                    }
                    setIsDeleting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, deleteOrder({
                            serviceRequestId: serviceRequestIdToDelete,
                            testItemName: testItemNameToDelete,
                        })];
                case 2:
                    success = _a.sent();
                    if (success) {
                        setIsDeleteDialogOpen(false);
                    }
                    else {
                        setDeleteError(locales.failedToDeleteLabOrder);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error(locales.errorConfirmingDelete, err_1);
                    errorMessage = err_1 instanceof Error ? err_1.message : locales.errorOccurredDuringDeletion;
                    setDeleteError(errorMessage);
                    return [3 /*break*/, 5];
                case 4:
                    setIsDeleting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [serviceRequestIdToDelete, testItemNameToDelete, deleteOrder, locales]);
    var DeleteOrderDialog = isDeleteDialogOpen ? (<material_1.Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
      <form style={{ padding: '10px' }} onSubmit={function (e) {
            e.preventDefault();
            void confirmDeleteOrder();
        }}>
        <material_1.DialogTitle variant="h5" color="primary.dark">
          {locales.deleteOrderDialogTitle}
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <material_1.DialogContentText>{locales.deleteOrderDialogContent(testItemNameToDelete)}</material_1.DialogContentText>
          {deleteError && (<material_1.Box sx={{ mt: 2, color: 'error.main' }}>
              <material_1.DialogContentText color="error">{deleteError}</material_1.DialogContentText>
            </material_1.Box>)}
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ px: 3, pb: 2, width: '100%', display: 'flex', justifyContent: 'space-between' }}>
          <material_1.Button variant="outlined" onClick={closeDeleteDialog} color="primary" disabled={isDeleting} sx={{ borderRadius: '50px', textTransform: 'none' }}>
            {locales.deleteOrderDialogKeepButton}
          </material_1.Button>
          <material_1.Button type="submit" variant="contained" color="error" disabled={isDeleting} startIcon={isDeleting ? <material_1.CircularProgress size={16} color="inherit"/> : null} sx={{ borderRadius: '50px', textTransform: 'none' }}>
            {isDeleting ? locales.deleteOrderDialogDeletingButton : locales.deleteOrderDialogDeleteButton}
          </material_1.Button>
        </material_1.DialogActions>
      </form>
    </material_1.Dialog>) : null;
    return {
        showDeleteLabOrderDialog: showDeleteLabOrderDialog,
        DeleteOrderDialog: DeleteOrderDialog,
    };
};
exports.useDeleteCommonLabOrderDialog = useDeleteCommonLabOrderDialog;
//# sourceMappingURL=useDeleteCommonLabOrderDialog.js.map