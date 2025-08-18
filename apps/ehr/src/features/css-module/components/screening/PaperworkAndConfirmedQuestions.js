"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Questions = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var appointment_1 = require("../../../../telemed/features/appointment");
var Questions = function () {
    var theme = (0, material_1.useTheme)();
    return (<material_1.Paper elevation={3} sx={{ pl: 1, pr: 3, pt: 3, pb: 1, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <material_1.Grid container>
        <material_1.Grid item xs={6} sx={{ borderRight: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <material_1.Box>
            <material_1.Typography variant="subtitle2" sx={{
            color: theme.palette.primary.dark,
            marginLeft: '16px',
        }}>
              PATIENT PROVIDED DURING REGISTRATION
            </material_1.Typography>
            <material_1.Box p={2}>
              <appointment_1.AdditionalQuestionsPatientColumn />
            </material_1.Box>
          </material_1.Box>
        </material_1.Grid>
        <material_1.Grid item xs={6}>
          <material_1.Box>
            <material_1.Typography variant="subtitle2" sx={{
            color: colors_1.otherColors.orange700,
            marginLeft: '16px',
        }}>
              CONFIRMED BY STAFF DURING VISIT
            </material_1.Typography>
            <material_1.Box p={2}>
              <appointment_1.AdditionalQuestionsProviderColumn />
            </material_1.Box>
          </material_1.Box>
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Paper>);
};
exports.Questions = Questions;
//# sourceMappingURL=PaperworkAndConfirmedQuestions.js.map