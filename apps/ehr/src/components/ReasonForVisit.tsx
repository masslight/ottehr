import { otherColors } from '@ehrTheme/colors';
import { Box, Modal, Typography } from '@mui/material';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { FLAGGED_REASONS_FOR_VISIT, MOBILE_MODAL_STYLE } from '../constants';
import { ApptTab } from './AppointmentTabs';
import { GenericToolTip } from './GenericToolTip';

interface ReasonsForVisitProps {
  reasonsForVisit: string;
  tab: ApptTab;
  formattedPriorityHighIcon: ReactElement;
  lineMax: number;
  isMobile?: boolean;
}

const ReasonsForVisit = ({
  reasonsForVisit,
  tab,
  formattedPriorityHighIcon,
  lineMax,
  isMobile = false,
}: ReasonsForVisitProps): ReactElement => {
  const [reasonIsOverflowing, setReasonIsOverflowing] = useState(false);
  const reasonRef = useRef<HTMLDivElement | null>(null);
  const [reason, reasonAdditional] = reasonsForVisit.split(' - ');
  const [mobileModalOpen, setMobileModalOpen] = useState<boolean>(false);

  const truncatedTextStyles = useMemo(() => {
    return {
      fontSize: '14px',
      display: '-webkit-box',
      WebkitLineClamp: lineMax,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };
  }, [lineMax]);

  const flagReason = useMemo(
    () => FLAGGED_REASONS_FOR_VISIT.includes(reason) && tab !== ApptTab.cancelled && tab !== ApptTab.completed,
    [reason, tab]
  );

  useEffect(() => {
    if (reasonRef.current) {
      const isOverflowing = reasonRef.current.scrollHeight > reasonRef.current.clientHeight;
      setReasonIsOverflowing(isOverflowing);
    }
  }, [reasonsForVisit]);

  const toolTipTitle = useMemo(() => {
    let title = flagReason ? 'Alert clinical team for immediate evaluation' : undefined;
    if (reasonIsOverflowing) {
      title = title ? `${title}\n${reasonsForVisit}` : reasonsForVisit;
    }
    return title;
  }, [flagReason, reasonIsOverflowing, reasonsForVisit]);

  const reasonForVisitReactElement = useMemo(
    () => (
      <Typography
        ref={reasonRef}
        sx={truncatedTextStyles}
        onClick={() => {
          if (isMobile && toolTipTitle) {
            setMobileModalOpen(true);
          }
        }}
      >
        {flagReason && formattedPriorityHighIcon}
        <span style={{ color: flagReason ? otherColors.priorityHighText : undefined, display: 'inline' }}>
          {reason}
        </span>
        {reasonAdditional && ` - ${reasonAdditional}`}
      </Typography>
    ),
    [flagReason, formattedPriorityHighIcon, isMobile, reason, reasonAdditional, toolTipTitle, truncatedTextStyles]
  );

  return (
    <>
      {toolTipTitle && !isMobile ? (
        <GenericToolTip title={toolTipTitle}>{reasonForVisitReactElement}</GenericToolTip>
      ) : (
        reasonForVisitReactElement
      )}
      {toolTipTitle && isMobile && (
        <Modal open={mobileModalOpen} onClose={() => setMobileModalOpen(false)}>
          <Box sx={MOBILE_MODAL_STYLE}>{toolTipTitle}</Box>
        </Modal>
      )}
    </>
  );
};

export default ReasonsForVisit;
