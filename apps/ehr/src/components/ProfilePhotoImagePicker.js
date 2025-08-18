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
require("./ProfilePhotoImagePicker.css");
var AddAPhotoOutlined_1 = require("@mui/icons-material/AddAPhotoOutlined");
var Close_1 = require("@mui/icons-material/Close");
var DeleteForeverOutlined_1 = require("@mui/icons-material/DeleteForeverOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var react_1 = require("react");
var react_easy_crop_1 = require("react-easy-crop");
var api_1 = require("../api/api");
var css_queries_1 = require("../features/css-module/queries/css.queries");
var canvasUtils_1 = require("../helpers/canvasUtils");
var useAppClients_1 = require("../hooks/useAppClients");
var PhotoProcessingState;
(function (PhotoProcessingState) {
    PhotoProcessingState[PhotoProcessingState["cropping"] = 0] = "cropping";
    PhotoProcessingState[PhotoProcessingState["cropped"] = 1] = "cropped";
    PhotoProcessingState[PhotoProcessingState["uploading"] = 2] = "uploading";
    PhotoProcessingState[PhotoProcessingState["uploaded"] = 3] = "uploaded";
})(PhotoProcessingState || (PhotoProcessingState = {}));
var VisuallyHiddenInput = (0, material_2.styled)('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});
var ProfilePhotoImagePicker = function (_a) {
    var _b, _c;
    var open = _a.open, setOpen = _a.setOpen, patient = _a.patient, onUpdate = _a.onUpdate;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _d = (0, react_1.useState)(undefined), photoProcessingState = _d[0], setPhotoProcessingState = _d[1];
    var _e = (0, react_1.useState)(undefined), currentProfileImage = _e[0], setCurrentProfileImage = _e[1];
    var _f = (0, react_1.useState)(undefined), croppedImageResult = _f[0], setCroppedImageResult = _f[1];
    // react-easy-crop computes the cropping area and updates this state
    var _g = (0, react_1.useState)(null), croppedAreaPixels = _g[0], setCroppedAreaPixels = _g[1];
    // Zoom level for cropping
    var _h = (0, react_1.useState)(1), zoom = _h[0], setZoom = _h[1];
    var _j = (0, react_1.useState)({ x: 0, y: 0 }), crop = _j[0], setCrop = _j[1];
    var _k = (0, react_1.useState)(false), isSavingImage = _k[0], setIsSavingImage = _k[1];
    var _l = (0, react_1.useState)(false), isSavingError = _l[0], setSavingError = _l[1];
    var hasAttachedPhoto = !!currentProfileImage;
    var patientPhotoUrlUnsigned = (_c = (_b = patient === null || patient === void 0 ? void 0 : patient.photo) === null || _b === void 0 ? void 0 : _b.at(0)) === null || _c === void 0 ? void 0 : _c.url;
    var isPhotoLoading = (0, css_queries_1.useGetSignedPatientProfilePhotoUrlQuery)(patientPhotoUrlUnsigned, function (profilePhotoResponse) {
        var presignedImageUrl = profilePhotoResponse.presignedImageUrl;
        clearPickedPhotoState();
        setCurrentProfileImage({
            alt: 'Profile photo',
            url: presignedImageUrl,
        });
        setCroppedImageResult({ imageUrl: presignedImageUrl });
        setPhotoProcessingState(PhotoProcessingState.cropped);
    }).isFetching;
    var editPatientProfilePhotoMutation = (0, css_queries_1.useEditPatientProfilePhotoMutation)();
    var updatePatientRecordWithPhotoUrl = (0, react_1.useCallback)(function (profilePhotoUrl) { return __awaiter(void 0, void 0, void 0, function () {
        var photoAttachments, patientData, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                        throw new Error('Patient reference not available');
                    }
                    photoAttachments = profilePhotoUrl
                        ? [
                            {
                                contentType: 'image/jpeg',
                                url: profilePhotoUrl,
                            },
                        ]
                        : undefined;
                    patientData = __assign(__assign({}, patient), { resourceType: 'Patient', id: patient.id, photo: photoAttachments });
                    return [4 /*yield*/, editPatientProfilePhotoMutation.mutateAsync({
                            originalPatient: patient,
                            newPatientData: patientData,
                        })];
                case 1:
                    _a.sent();
                    onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate(patientData);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    setSavingError(true);
                    console.error('Error while updating Patient fhir resource: ', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [editPatientProfilePhotoMutation, onUpdate, patient]);
    var clearPickedPhotoState = function () {
        setCurrentProfileImage(undefined);
        setPhotoProcessingState(undefined);
        setCroppedImageResult(undefined);
        setSavingError(false);
    };
    var handleRemovePhotoClick = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    clearPickedPhotoState();
                    return [4 /*yield*/, updatePatientRecordWithPhotoUrl(undefined)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [updatePatientRecordWithPhotoUrl]);
    var handleInputChange = function (event) {
        var _a;
        var files = event.target.files;
        var allFiles = (_a = (files && Array.from(files))) !== null && _a !== void 0 ? _a : [];
        var capturedPhotoFile = allFiles.at(0);
        if (!capturedPhotoFile) {
            console.warn('No photo file selected/available - earlier skip!');
            return;
        }
        var photoFileUrl = URL.createObjectURL(capturedPhotoFile);
        setCurrentProfileImage({
            alt: 'Profile photo',
            url: photoFileUrl,
        });
        setPhotoProcessingState(PhotoProcessingState.cropping);
        setCroppedImageResult(undefined);
        setSavingError(false);
    };
    var handlePhotoSaveClicked = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var photoUrl, imageCroppingResult, imageFile, patientId, uploadResponse, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, 5, 6]);
                    setIsSavingImage(true);
                    if (!oystehrZambda) {
                        console.warn('zambdaClient not available - skip uploading');
                        return [2 /*return*/];
                    }
                    photoUrl = currentProfileImage === null || currentProfileImage === void 0 ? void 0 : currentProfileImage.url;
                    if (!photoUrl) {
                        console.warn('No photoUrl to process - skip processing');
                        return [2 /*return*/];
                    }
                    if (!croppedAreaPixels) {
                        console.warn('No croppedAreaPixels to process - skip processing');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, canvasUtils_1.getCroppedImg)(photoUrl, croppedAreaPixels)];
                case 1:
                    imageCroppingResult = _a.sent();
                    if (!imageCroppingResult) {
                        console.warn("Can not crop a given photo - skip saving");
                        return [2 /*return*/];
                    }
                    imageFile = imageCroppingResult.imageFile;
                    setCroppedImageResult(imageCroppingResult);
                    setPhotoProcessingState(PhotoProcessingState.cropped);
                    if (!imageFile) {
                        console.warn("imageFile is undefined - skip saving");
                        return [2 /*return*/];
                    }
                    setPhotoProcessingState(PhotoProcessingState.uploading);
                    patientId = patient === null || patient === void 0 ? void 0 : patient.id;
                    if (!patientId) {
                        console.warn('patientId not available - skip uploading');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, api_1.uploadPatientProfilePhoto)(oystehrZambda, {
                            patientId: patientId,
                            patientPhotoFile: imageFile,
                        })];
                case 2:
                    uploadResponse = _a.sent();
                    if (!uploadResponse) {
                        console.warn("uploading patient profile photo failed - skip saving");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, updatePatientRecordWithPhotoUrl(uploadResponse.z3ImageUrl)];
                case 3:
                    _a.sent();
                    setPhotoProcessingState(PhotoProcessingState.uploaded);
                    return [3 /*break*/, 6];
                case 4:
                    e_1 = _a.sent();
                    console.error(e_1);
                    return [3 /*break*/, 6];
                case 5:
                    setIsSavingImage(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [currentProfileImage, croppedAreaPixels, updatePatientRecordWithPhotoUrl, patient, oystehrZambda]);
    var onCropComplete = (0, react_1.useCallback)(function (croppedArea, croppedAreaPixels) {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);
    // Dialog's control buttons bar
    var renderControlButtons = function () {
        if (!hasAttachedPhoto) {
            return (<material_1.Button variant="outlined" component="label" disabled={false} color="primary" sx={{
                    borderRadius: '16px',
                    textTransform: 'none',
                    mt: 2,
                    fontWeight: 'bold',
                }} startIcon={<AddAPhotoOutlined_1.default fontSize="small"/>}>
          Take photo
          <VisuallyHiddenInput onChange={function (e) { return handleInputChange(e); }} type="file" capture="environment" accept="image/*"/>
        </material_1.Button>);
        }
        if (photoProcessingState === PhotoProcessingState.cropping ||
            photoProcessingState === PhotoProcessingState.uploading) {
            return (<lab_1.LoadingButton loading={isSavingImage} variant="contained" onClick={function () { return handlePhotoSaveClicked(); }} sx={{
                    fontWeight: 'bold',
                    borderRadius: '16px',
                    textTransform: 'none',
                }}>
          Save
        </lab_1.LoadingButton>);
        }
        return (<>
        <material_1.Button variant="outlined" component="label" disabled={false} color="primary" sx={{
                borderRadius: '16px',
                textTransform: 'none',
                mt: 2,
                fontWeight: 'bold',
            }} startIcon={<AddAPhotoOutlined_1.default fontSize="small"/>}>
          Retake photo
          <VisuallyHiddenInput onChange={function (e) { return handleInputChange(e); }} type="file" capture="environment" accept="image/*"/>
        </material_1.Button>

        <material_1.Button onClick={handleRemovePhotoClick} variant="outlined" component="label" disabled={false} color="error" sx={{
                borderRadius: '16px',
                textTransform: 'none',
                mt: 2,
                ml: 3,
                fontWeight: 'bold',
            }} startIcon={<DeleteForeverOutlined_1.default fontSize="small"/>}>
          Remove photo
        </material_1.Button>
      </>);
    };
    return (<material_1.Dialog open={open} onClose={function () {
            setOpen(false);
        }} PaperProps={{
            style: {
                backgroundColor: 'white',
                boxShadow: 'none',
                maxWidth: '900px',
            },
        }}>
      <material_1.DialogTitle marginBottom={0}>
        <material_1.Grid container alignItems="center" justifyContent="space-between" sx={{ width: '100%', border: 1, borderColor: 'white' }}>
          <material_1.Grid item xs/>
          <material_1.Grid item>
            {photoProcessingState === PhotoProcessingState.cropping && (<material_1.Typography variant="h6" align="center">
                Please crop the image
              </material_1.Typography>)}
            {isSavingError && (<material_1.Typography color="error" variant="h6" align="center">
                There was an error updating photo, please try again.
              </material_1.Typography>)}
          </material_1.Grid>
          <material_1.Grid item xs container justifyContent="flex-end">
            <material_1.IconButton onClick={function () {
            setOpen(false);
        }}>
              <Close_1.default sx={{ color: '#938B7D' }}/>
            </material_1.IconButton>
          </material_1.Grid>
        </material_1.Grid>
      </material_1.DialogTitle>

      <material_1.Box sx={{
            minWidth: '500px',
            width: '100%',
            height: '50vh',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            '& img': {
                paddingX: '32px',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
            },
        }}>
        {/* Show cropper to give ability to modify the image */}
        {currentProfileImage && photoProcessingState === PhotoProcessingState.cropping && (<material_1.Box mt={2} textAlign="center">
            <react_easy_crop_1.default image={currentProfileImage === null || currentProfileImage === void 0 ? void 0 : currentProfileImage.url} crop={crop} zoom={zoom} aspect={3 / 4} onZoomChange={setZoom} onCropComplete={onCropComplete} onCropChange={setCrop}/>
          </material_1.Box>)}

        {!hasAttachedPhoto && isPhotoLoading && (<material_1.Box sx={{ justifyContent: 'center', display: 'flex' }}>
            <material_1.CircularProgress />
          </material_1.Box>)}

        {!hasAttachedPhoto && !isPhotoLoading && (<material_1.Typography variant="h6" color="primary.dark" sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}>
            Please take the photo
          </material_1.Typography>)}

        {/* Preview for the cropped image */}
        {(croppedImageResult === null || croppedImageResult === void 0 ? void 0 : croppedImageResult.imageUrl) && <img src={croppedImageResult.imageUrl} alt={currentProfileImage === null || currentProfileImage === void 0 ? void 0 : currentProfileImage.alt}/>}
      </material_1.Box>

      <material_1.DialogContent style={{ overflow: 'hidden' }}>
        <material_1.Box alignItems="center" display="flex" sx={{ mb: 1 }}>
          {renderControlButtons()}
        </material_1.Box>
      </material_1.DialogContent>
    </material_1.Dialog>);
};
exports.default = ProfilePhotoImagePicker;
//# sourceMappingURL=ProfilePhotoImagePicker.js.map