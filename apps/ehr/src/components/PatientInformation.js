"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PatientInformation;
var material_1 = require("@mui/material");
var react_1 = require("react");
var CopyButton_1 = require("./CopyButton");
var CopyFields = [
    'Member ID',
    'Street address',
    'Address line 2',
    'Patient email',
    'Patient mobile',
    'Phone',
    'Parent/Guardian email',
    'Parent/Guardian mobile',
    'Patient mobile',
    'PCP phone number',
    'Pharmacy phone number',
    "Policy holder's name",
    "Policy holder's date of birth",
    'Full name',
    'Date of birth',
];
function PatientInformation(_a) {
    var loading = _a.loading, patientDetails = _a.patientDetails, title = _a.title, icon = _a.icon, _b = _a.width, width = _b === void 0 ? '100%' : _b, editValue = _a.editValue, element = _a.element, lastModifiedBy = _a.lastModifiedBy;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Paper sx={{
            marginTop: 2,
            padding: 3,
        }}>
      <material_1.Typography variant="h4" color="primary.dark">
        {title}
      </material_1.Typography>
      {patientDetails && (<material_1.Table size="small" style={{ tableLayout: 'fixed', width: width }}>
          <material_1.TableBody>
            {Object.keys(patientDetails).map(function (patientDetailsKey) {
                var _a;
                var lastMod = lastModifiedBy && lastModifiedBy[patientDetailsKey];
                return (<react_1.Fragment key={patientDetailsKey}>
                  <material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <>
                      <material_1.TableCell sx={{
                        width: '50%',
                        color: theme.palette.primary.dark,
                        paddingLeft: 0,
                        borderBottom: lastMod ? 'none' : 'auto',
                    }}>
                        <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                          {patientDetailsKey}
                          {icon ? icon[patientDetailsKey] : ''}
                        </material_1.Box>
                      </material_1.TableCell>
                      <material_1.TableCell sx={{
                        textAlign: 'right',
                        wordWrap: 'break-word',
                        paddingRight: 0,
                        borderBottom: lastMod ? 'none' : 'auto',
                    }}>
                        <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {loading ? (<material_1.Skeleton aria-busy="true" width={200}/>) : (<material_1.Box sx={{ display: 'flex', gap: 2, wordBreak: 'break-word' }}>
                              {editValue && patientDetails[patientDetailsKey] && editValue[patientDetailsKey]}
                              {patientDetails[patientDetailsKey] || '-'}
                              {patientDetails[patientDetailsKey] && CopyFields.includes(patientDetailsKey.trim()) && (<CopyButton_1.default text={(_a = patientDetails[patientDetailsKey]) !== null && _a !== void 0 ? _a : ''}/>)}
                            </material_1.Box>)}
                        </material_1.Box>
                      </material_1.TableCell>
                    </>
                  </material_1.TableRow>
                  {lastMod && (<material_1.TableRow>
                      <material_1.TableCell colSpan={2} sx={{
                            textAlign: 'right',
                            wordWrap: 'break-word',
                            paddingRight: 0,
                            paddingTop: 0,
                            fontSize: '12px',
                        }}>
                        Last Modified {lastMod}
                      </material_1.TableCell>
                    </material_1.TableRow>)}
                </react_1.Fragment>);
            })}
          </material_1.TableBody>
        </material_1.Table>)}
      {element}
    </material_1.Paper>);
}
//# sourceMappingURL=PatientInformation.js.map