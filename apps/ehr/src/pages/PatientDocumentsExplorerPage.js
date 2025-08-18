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
var Add_1 = require("@mui/icons-material/Add");
var SearchOutlined_1 = require("@mui/icons-material/SearchOutlined");
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var DateSearch_1 = require("../components/DateSearch");
var LoadingScreen_1 = require("../components/LoadingScreen");
var patient_1 = require("../components/patient");
var PatientDocumentFoldersColumn_1 = require("../components/patient/docs/PatientDocumentFoldersColumn");
var PatientDocumentsExplorerTable_1 = require("../components/patient/docs/PatientDocumentsExplorerTable");
var RoundedButton_1 = require("../components/RoundedButton");
var useGetPatient_1 = require("../hooks/useGetPatient");
var useGetPatientDocs_1 = require("../hooks/useGetPatientDocs");
var patient_store_1 = require("../state/patient.store");
var FileAttachmentHiddenInput = (0, material_2.styled)('input')({
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
var PatientDocumentsExplorerPage = function () {
    var _a;
    var theme = (0, material_1.useTheme)();
    var patientId = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _b = (0, useGetPatient_1.useGetPatient)(patientId), patient = _b.patient, isLoadingPatientData = _b.loading;
    (0, react_1.useEffect)(function () {
        if (!patient)
            return;
        patient_store_1.usePatientStore.setState({
            patient: patient,
        });
    }, [patient]);
    var _c = (0, useGetPatientDocs_1.useGetPatientDocs)(patientId), documents = _c.documents, isLoadingDocuments = _c.isLoadingDocuments, documentsFolders = _c.documentsFolders, isLoadingFolders = _c.isLoadingFolders, searchDocuments = _c.searchDocuments, downloadDocument = _c.downloadDocument, documentActions = _c.documentActions;
    var _d = (0, react_1.useState)(''), searchDocNameFieldValue = _d[0], setSearchDocNameFieldValue = _d[1];
    var _e = (0, react_1.useState)(''), docNameTextDebounced = _e[0], setDocNameTextDebounced = _e[1];
    var _f = (0, react_1.useState)(null), searchDocAddedDate = _f[0], setSearchDocAddedDate = _f[1];
    var _g = (0, react_1.useState)(undefined), selectedFolder = _g[0], setSelectedFolder = _g[1];
    var shouldShowClearFilters = searchDocNameFieldValue.trim().length > 0 || searchDocAddedDate || selectedFolder;
    var handleBackClickWithConfirmation = function () {
        navigate(-1);
    };
    (0, react_1.useEffect)(function () {
        var searchDateFromState = searchDocAddedDate ? searchDocAddedDate : undefined;
        var filters = {
            documentName: docNameTextDebounced,
            documentsFolder: selectedFolder,
            dateAdded: searchDateFromState,
        };
        searchDocuments(filters);
    }, [docNameTextDebounced, searchDocAddedDate, selectedFolder, searchDocuments]);
    var debounceTextInput = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (value, onDebounced) {
            onDebounced(value);
        }, 2000);
    }, []);
    var handleSearchDocAddedDateChange = (0, react_1.useCallback)(function (event, value, field) {
        if (field === 'date') {
            var selectedDate = luxon_1.DateTime.fromISO(value);
            setSearchDocAddedDate(selectedDate);
        }
    }, []);
    var handleSearchButtonClick = (0, react_1.useCallback)(function () {
        var searchDateFromState = searchDocAddedDate ? searchDocAddedDate : undefined;
        var filters = {
            documentName: docNameTextDebounced,
            documentsFolder: selectedFolder,
            dateAdded: searchDateFromState,
        };
        searchDocuments(filters);
    }, [docNameTextDebounced, searchDocAddedDate, searchDocuments, selectedFolder]);
    var handleSearchInputChange = (0, react_1.useCallback)(function (e) {
        var textValue = e.target.value;
        setSearchDocNameFieldValue(textValue);
        debounceTextInput(textValue, function () {
            setDocNameTextDebounced(textValue);
        });
    }, [debounceTextInput]);
    var handleFolderSelected = (0, react_1.useCallback)(function (folder) {
        var folderToSelect = folder.id !== (selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.id) ? folder : undefined;
        setSelectedFolder(folderToSelect);
    }, [selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.id]);
    var handleClearFilters = (0, react_1.useCallback)(function () {
        setSearchDocAddedDate(null);
        setSelectedFolder(undefined);
        setDocNameTextDebounced('');
        setSearchDocNameFieldValue('');
        searchDocuments({});
    }, [searchDocuments]);
    var handleDocumentUploadInputChange = (0, react_1.useCallback)(function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var files, allFiles, selectedFile, fileName, validFileNamePattern, folderId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    files = event.target.files;
                    allFiles = (_a = (files && Array.from(files))) !== null && _a !== void 0 ? _a : [];
                    selectedFile = allFiles.at(0);
                    if (!selectedFile) {
                        console.warn('No file selected/available - earlier skip!');
                        return [2 /*return*/];
                    }
                    fileName = selectedFile.name;
                    validFileNamePattern = /^[a-zA-Z0-9+!\-_'()\\.@$]+$/;
                    if (!validFileNamePattern.test(fileName)) {
                        (0, notistack_1.enqueueSnackbar)("Invalid file name. Spaces are not allowed. Only letters, numbers, and these characters are allowed: + ! - _ ' ( ) . @ $", {
                            variant: 'error',
                        });
                        event.target.value = '';
                        return [2 /*return*/];
                    }
                    folderId = selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.id;
                    if (!folderId) {
                        console.warn('No folder selected - earlier skip!');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, documentActions.uploadDocumentAction({
                            docFile: selectedFile,
                            fileName: fileName,
                            fileFolderId: folderId,
                        })];
                case 1:
                    _b.sent();
                    event.target.value = '';
                    return [2 /*return*/];
            }
        });
    }); }, [documentActions, selectedFolder === null || selectedFolder === void 0 ? void 0 : selectedFolder.id]);
    var documentTableActions = (0, react_1.useMemo)(function () {
        return {
            isActionAllowed: function () {
                return true;
            },
            onDocumentDownload: downloadDocument,
        };
    }, [downloadDocument]);
    if (isLoadingPatientData)
        return <LoadingScreen_1.LoadingScreen />;
    return (<material_1.Box>
      <patient_1.Header handleDiscard={handleBackClickWithConfirmation} id={patientId}/>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CustomBreadcrumbs_1.default chain={[
            { link: '/patients', children: 'Patients' },
            {
                link: "/patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id),
                children: patient ? (0, utils_1.getFullName)(patient) : '',
            },
            {
                link: '#',
                children: "Patient Information",
            },
        ]}/>
          <material_1.Typography variant="subtitle1" color="primary.main">
            Docs
          </material_1.Typography>

          <material_1.Paper sx={{ padding: 3 }} component={material_1.Stack} spacing={2}>
            <material_1.Grid container sx={{
            height: 'auto',
            width: '50%',
            backgroundColor: 'transparent',
        }}>
              <material_1.Grid item xs={7}>
                <material_1.TextField disabled={false} value={searchDocNameFieldValue} onChange={handleSearchInputChange} fullWidth size="small" label="Document" placeholder="Search" InputLabelProps={{ shrink: true }} InputProps={{
            endAdornment: (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <material_1.IconButton aria-label="clear patient search" onClick={handleSearchButtonClick} onMouseDown={function (event) { return event.preventDefault(); }} sx={{ p: 0 }}>
                          <SearchOutlined_1.default />
                        </material_1.IconButton>
                      </material_1.Box>),
        }}/>
              </material_1.Grid>

              <material_1.Grid item xs={4}>
                <material_1.Box sx={{ ml: 2, flexDirection: 'row' }}>
                  <DateSearch_1.default label="Added Date" date={searchDocAddedDate} setDate={setSearchDocAddedDate} updateURL={false} storeDateInLocalStorage={false} closeOnSelect={true} small={true} handleSubmit={handleSearchDocAddedDateChange}/>
                </material_1.Box>
              </material_1.Grid>

              <material_1.Grid item xs={1}>
                <material_1.Box sx={{ ml: 2, flexDirection: 'row' }}>
                  {shouldShowClearFilters && (<RoundedButton_1.RoundedButton target="_blank" variant="text" sx={{ color: theme.palette.error.main }} onClick={handleClearFilters}>
                      Clear filters
                    </RoundedButton_1.RoundedButton>)}
                </material_1.Box>
              </material_1.Grid>
            </material_1.Grid>

            <material_1.Grid container sx={{
            height: 'auto',
            width: '100%',
        }}>
              <material_1.Grid item xs={3}>
                <material_1.Box sx={{
            backgroundColor: '#F9FAFB',
            borderRadius: 2,
        }}>
                  {isLoadingFolders ? (<PatientDocumentFoldersColumn_1.PatientDocumentFoldersColumnSkeleton stubsCount={4}/>) : (<PatientDocumentFoldersColumn_1.PatientDocumentFoldersColumn documentsFolders={documentsFolders} selectedFolder={selectedFolder} onFolderSelected={handleFolderSelected}/>)}
                </material_1.Box>
              </material_1.Grid>

              <material_1.Grid item xs={9} sx={{ pl: 2 }}>
                <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {selectedFolder ? (<material_1.Typography color="primary.main" sx={{ flexGrow: 1, fontSize: '24px', fontWeight: 800 }}>
                      {selectedFolder.folderName} {isLoadingDocuments ? '' : "- ".concat((_a = documents === null || documents === void 0 ? void 0 : documents.length) !== null && _a !== void 0 ? _a : 0)}
                    </material_1.Typography>) : (<material_1.Typography color="primary.main" sx={{ flexGrow: 1, fontSize: '24px', fontWeight: 800 }}>
                      All documents
                    </material_1.Typography>)}

                  <RoundedButton_1.RoundedButton disabled={!selectedFolder || documentActions.isUploading} loading={documentActions.isUploading} component="label" target="_blank" variant="outlined" startIcon={<Add_1.default fontSize="small"/>}>
                    Upload New Doc
                    <FileAttachmentHiddenInput onChange={handleDocumentUploadInputChange} type="file" capture="environment"/>
                  </RoundedButton_1.RoundedButton>
                </material_1.Box>

                <PatientDocumentsExplorerTable_1.PatientDocumentsExplorerTable isLoadingDocs={isLoadingDocuments} documents={documents} documentTableActions={documentTableActions}/>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Paper>
        </material_1.Box>
      </material_1.Box>
    </material_1.Box>);
};
exports.default = PatientDocumentsExplorerPage;
//# sourceMappingURL=PatientDocumentsExplorerPage.js.map