"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationHistoryList = void 0;
var ArrowDropDown_1 = require("@mui/icons-material/ArrowDropDown");
var ArrowDropUp_1 = require("@mui/icons-material/ArrowDropUp");
var material_1 = require("@mui/material");
var react_1 = require("react");
var useMedicationHistory_1 = require("src/features/css-module/hooks/useMedicationHistory");
var components_1 = require("../../../../../telemed/components");
var ButtonStyled_1 = require("../../generic-notes-list/components/ui/ButtonStyled");
var MedicationHistoryEntity_1 = require("./MedicationHistoryEntity");
var MedicationHistoryList = function () {
    var _a = (0, react_1.useState)(false), isCollapsed = _a[0], setIsCollapsed = _a[1];
    var _b = (0, react_1.useState)(false), seeMoreOpen = _b[0], setSeeMoreOpen = _b[1];
    var _c = (0, useMedicationHistory_1.useMedicationHistory)(), isLoading = _c.isLoading, medicationHistory = _c.medicationHistory;
    // todo: need to update react-query and use isInitialLoading
    var showSkeletons = isLoading && medicationHistory.length === 0;
    var shownMeds = (0, react_1.useMemo)(function () {
        if (!seeMoreOpen) {
            return medicationHistory.slice(0, useMedicationHistory_1.COLLAPSED_MEDS_COUNT);
        }
        else {
            return medicationHistory;
        }
    }, [seeMoreOpen, medicationHistory]);
    var handleToggle = function () {
        setIsCollapsed(function (v) { return !v; });
    };
    var toggleShowMore = function () {
        setSeeMoreOpen(function (state) { return !state; });
    };
    var getSeeMoreButtonLabel = function () {
        return seeMoreOpen ? 'See less' : 'See more';
    };
    return (<components_1.AccordionCard label="Medication History" collapsed={isCollapsed} onSwitch={handleToggle}>
      <material_1.Box sx={{ px: 3, py: 1 }}>
        <material_1.TableContainer component={material_1.Paper} elevation={0}>
          <material_1.Table>
            <material_1.TableHead>
              <material_1.TableRow>
                <material_1.TableCell>Medication</material_1.TableCell>
                <material_1.TableCell>Type</material_1.TableCell>
                <material_1.TableCell>Who Added</material_1.TableCell>
                <material_1.TableCell>Last Time Taken</material_1.TableCell>
              </material_1.TableRow>
            </material_1.TableHead>
            <material_1.TableBody>
              {showSkeletons ? (<>
                  <material_1.TableRow>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                  </material_1.TableRow>
                  <material_1.TableRow>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                  </material_1.TableRow>
                  <material_1.TableRow>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Skeleton width={'100%'} height={24}/>
                    </material_1.TableCell>
                  </material_1.TableRow>
                </>) : (shownMeds.map(function (item) { return <MedicationHistoryEntity_1.MedicationHistoryEntity key={item.resourceId} item={item}/>; }))}
            </material_1.TableBody>
          </material_1.Table>
        </material_1.TableContainer>

        {!showSkeletons && medicationHistory.length > useMedicationHistory_1.COLLAPSED_MEDS_COUNT && (<ButtonStyled_1.ButtonStyled onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUp_1.default /> : <ArrowDropDown_1.default />}>
            {getSeeMoreButtonLabel()}
          </ButtonStyled_1.ButtonStyled>)}
        {!showSkeletons && medicationHistory.length === 0 && (<material_1.Typography variant="body1" sx={{ opacity: 0.65 }}>
            No previous medication history available
          </material_1.Typography>)}
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.MedicationHistoryList = MedicationHistoryList;
//# sourceMappingURL=MedicationHistoryList.js.map