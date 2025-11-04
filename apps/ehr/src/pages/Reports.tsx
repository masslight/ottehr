import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { Box, Card, CardActionArea, CardContent, Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../layout/PageContainer';

interface ReportTileProps {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  onClick: () => void;
}

function ReportTile({ title, description, icon, onClick }: ReportTileProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: 200,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
        cursor: 'pointer',
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 2,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              color: 'white',
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 32 } })}
          </Box>
          <Typography variant="h6" component="h2" fontWeight={600} color="primary.dark">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Reports(): React.ReactElement {
  const navigate = useNavigate();

  const reportTiles = [
    {
      title: 'Incomplete Encounters',
      description: 'View and manage encounters that are missing required information or documentation',
      icon: <AssignmentLateIcon />,
      path: '/reports/incomplete-encounters',
    },
    {
      title: 'AI-Assisted Encounters',
      description: 'View encounters with AI-generated documentation and assistant interactions',
      icon: <PsychologyIcon />,
      path: '/reports/ai-assisted-encounters',
    },
    {
      title: 'Daily Payments',
      description: 'Review daily payment reports and transaction summaries',
      icon: <AttachMoneyIcon />,
      path: '/reports/daily-payments',
    },
    {
      title: 'Visits Overview',
      description: 'View appointment statistics and charts showing visit types (in-person vs telemed)',
      icon: <AssessmentIcon />,
      path: '/reports/visits-overview',
    },
    {
      title: 'Workflow Efficiency',
      description: 'Analyze visit metrics, time-to-provider statistics, and appointment status workflows',
      icon: <AssessmentIcon />,
      path: '/reports/workflow-efficiency',
    },
    {
      title: 'Data Exports',
      description: 'Export clinical and administrative data including appointments, encounters, and charts',
      icon: <CloudDownloadIcon />,
      path: '/reports/data-exports',
    },
    {
      title: 'Invoiceable patients',
      description: 'View invoiceable patients report',
      icon: <SummarizeIcon />,
      path: '/reports/invoiceable-patients',
    },
  ];

  const handleTileClick = (path: string): void => {
    navigate(path);
  };

  return (
    <PageContainer>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom color="primary.dark" fontWeight={600}>
            Reports
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a report to view detailed information and analytics
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {reportTiles.map((tile) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={tile.path}>
              <ReportTile
                title={tile.title}
                description={tile.description}
                icon={tile.icon}
                path={tile.path}
                onClick={() => handleTileClick(tile.path)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </PageContainer>
  );
}
