import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getLegalCompositionForLocation } from 'utils';
import { DisplayTextDef } from 'utils/lib/configuration/types';

interface TermsAndConditionsProps {
  pageId: string;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ pageId }) => {
  const theme = useTheme();

  const legalComposition = getLegalCompositionForLocation(pageId);
  if (!legalComposition) {
    return null;
  }

  return (
    <Typography color={theme.palette.text.secondary} variant="body2">
      {/* this rendering of link and text nodes is pretty generic and could be extracted to its own component at some point */}
      {legalComposition.map((node, index) => {
        if (node.nodeType === 'Link') {
          return (
            <Link key={`${node.testId || node.url}-${index}`} to={node.url} target="_blank" data-testid={node.testId}>
              <TextNode {...node.textToDisplay} />
            </Link>
          );
        } else {
          return <TextNode key={`${node.keyPath || node.literal}-${index}`} {...node} />;
        }
      })}
      {'.'}
    </Typography>
  );
};

const TextNode = (node: DisplayTextDef): React.ReactElement => {
  const { t } = useTranslation();
  if (node.keyPath) {
    return <>{t(node.keyPath)}</>;
  }
  return <>{node.literal || ''}</>;
};
