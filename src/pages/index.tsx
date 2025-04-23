// pages/index.tsx (Дашборд)
'use client'; // Required for client-side hooks

import * as React from 'react';
import useSWR from 'swr';

// MUI Components
import Box from '@mui/material/Box'; // Use Box for layout
import Typography from '@mui/material/Typography';
// import Grid from '@mui/material/Grid'; // Grid is no longer needed for the main layout
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link'; // Use MUI Link for styling consistency
import NextLink from 'next/link'; // Use Next.js Link for navigation

// MUI Icons
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import InventoryIcon from '@mui/icons-material/Inventory';

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => {
            (error as any).info = info;
            throw error;
        }).catch(() => { throw error; });
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return res.json();
});

// --- Define expected data types from the API ---
type LowStockItem = {
  assetTypeId: number;
  assetTypeName: string;
  categoryName: string;
  minimumStockLevel: number | null;
  currentStock: number;
};

type RecentActivity = {
  activityType: 'assigned' | 'returned' | 'written_off';
  date: string;
  employeeFullName: string | null;
  assetTypeName: string | null;
  inventoryNumber: string | null;
  assetInstanceId: number;
};

type DashboardData = {
  lowStockItems: LowStockItem[];
  recentActivities: RecentActivity[];
};

// Helper function to format date string
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        console.error("Failed to format date:", dateString, e);
        return dateString;
    }
};

// Helper to get icon based on activity type
const getActivityIcon = (type: RecentActivity['activityType']) => {
    switch (type) {
        case 'assigned': return <AssignmentIndIcon color="primary" fontSize="small"/>;
        case 'returned': return <KeyboardReturnIcon color="success" fontSize="small"/>;
        case 'written_off': return <DeleteForeverIcon color="error" fontSize="small"/>;
        default: return <HistoryIcon fontSize="small"/>;
    }
};

// Helper to get activity description
const getActivityDescription = (activity: RecentActivity): React.ReactNode => {
    const assetInfo = (
        <Tooltip title={`ID Екземпляра: ${activity.assetInstanceId}`}>
            <Box component="span" sx={{ fontWeight: 500 }}>
                {activity.assetTypeName || 'Невідомий тип'} ({activity.inventoryNumber || 'N/A'})
            </Box>
        </Tooltip>
    );
    switch (activity.activityType) {
        case 'assigned': return <>Видано {assetInfo} співробітнику <strong>{activity.employeeFullName || 'N/A'}</strong></>;
        case 'returned': return <>Повернено {assetInfo} від <strong>{activity.employeeFullName || 'N/A'}</strong></>;
        case 'written_off': return <>Списано {assetInfo}</>;
        default: return 'Невідома дія';
    }
};


export default function DashboardPage() {
  const { data: dashboardData, error, isLoading } = useSWR<DashboardData>(
      '/api/dashboard/summary',
      fetcher,
      { refreshInterval: 300000 }
  );

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Дашборд
      </Typography>

      {/* --- Loading State --- */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <CircularProgress size={60} />
        </Box>
      )}

      {/* --- Error State --- */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Не вдалося завантажити дані для дашборду.
          <Typography variant="caption" display="block">
            {(error as any).info?.message || error.message || 'Перевірте з\'єднання або спробуйте пізніше.'}
          </Typography>
        </Alert>
      )}

      {/* --- Data Display --- */}
      {!isLoading && !error && dashboardData && (
        // Use Box with Flexbox for layout instead of Grid
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' }, // Stack on small screens, row on medium+
            gap: 3, // Spacing between items (replaces Grid spacing)
          }}
        >
          {/* --- First Flex Item (Low Stock Card) --- */}
          {/* Use Box as the flex item, controlling its width */}
          <Box sx={{ flex: 1, minWidth: 0 }}> {/* flex: 1 allows items to grow/shrink equally */}
            <Card elevation={3} sx={{ height: '100%' }}> {/* Ensure card takes full height of flex item */}
              <CardHeader
                avatar={<WarningAmberIcon color="warning" />}
                title="Низький Залишок на Складі"
                slotProps={{ title: { variant: 'h6' } }}
                sx={{ pb: 0 }}
              />
              <CardContent>
                {dashboardData.lowStockItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                    Немає активів з низьким залишком.
                  </Typography>
                ) : (
                  <List dense>
                    {dashboardData.lowStockItems.map((item) => (
                      <ListItem key={item.assetTypeId} disableGutters divider>
                        <ListItemText
                          primary={
                            <NextLink href={`/inventory?typeId=${item.assetTypeId}`} passHref legacyBehavior>
                                <Link underline="hover" color="inherit" sx={{cursor: 'pointer'}}>
                                    {item.assetTypeName}
                                </Link>
                            </NextLink>
                           }
                          secondary={`Категорія: ${item.categoryName}`}
                        />
                        <Chip
                          label={`Залишок: ${item.currentStock} (мін: ${item.minimumStockLevel ?? 'N/A'})`}
                          color="warning"
                          size="small"
                          variant="outlined"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box> {/* End First Flex Item */}

          {/* --- Second Flex Item (Recent Activities Card) --- */}
          <Box sx={{ flex: 1, minWidth: 0 }}> {/* flex: 1 allows items to grow/shrink equally */}
            <Card elevation={3} sx={{ height: '100%' }}> {/* Ensure card takes full height of flex item */}
               <CardHeader
                avatar={<HistoryIcon color="action" />}
                title="Останні Дії"
                slotProps={{ title: { variant: 'h6' } }}
                 sx={{ pb: 0 }}
              />
              <CardContent>
                {dashboardData.recentActivities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                    Немає нещодавніх дій.
                  </Typography>
                ) : (
                  <List dense>
                    {dashboardData.recentActivities.map((activity, index) => (
                      <ListItem key={`${activity.assetInstanceId}-${activity.date}-${index}`} disableGutters divider>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {getActivityIcon(activity.activityType)}
                        </ListItemIcon>
                        <ListItemText
                          primary={getActivityDescription(activity)}
                          secondary={formatDate(activity.date)}
                           primaryTypographyProps={{ variant: 'body2' }}
                           secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box> {/* End Second Flex Item */}

        </Box> // End Flex container
      )}
    </Box>
  );
}
