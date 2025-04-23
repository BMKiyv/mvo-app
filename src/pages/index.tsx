// pages/index.tsx (Дашборд)
'use client'; // Required for client-side hooks

import * as React from 'react';
import useSWR from 'swr';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
// import Grid from '@mui/material/Grid'; // Grid is no longer needed
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
            (error as any).info = info; // Attach detailed error info if available
            throw error;
        }).catch(() => {
            // If response body is not JSON or empty, throw the original error
            throw error;
        });
    }
    // Handle empty response body for potentially null results
     if (res.status === 204 || res.headers.get('content-length') === '0') {
        return null; // Return null for empty responses
     }
    return res.json(); // Parse JSON body for successful responses
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
  type: 'assigned' | 'returned' | 'written_off'; // Updated type name
  date: string; // API returns date as string
  employeeFullName: string | null;
  assetTypeName: string | null;
  inventoryNumber: string | null;
  assetInstanceId: number;
  keySource: string; // Added unique key source
};

type DashboardData = {
  lowStockItems: LowStockItem[];
  recentActivities: RecentActivity[];
};

// Helper function to format date string
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
         // Use Ukraine locale for formatting
        return date.toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        console.error("Failed to format date:", dateString, e);
        return dateString; // Return original string if parsing fails
    }
};

// Helper to get icon based on activity type
const getActivityIcon = (type: RecentActivity['type']) => { // Use updated type name
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
    switch (activity.type) { // Use updated type name
        case 'assigned': return <>Видано {assetInfo} співробітнику <strong>{activity.employeeFullName || 'N/A'}</strong></>;
        case 'returned': return <>Повернено {assetInfo} від <strong>{activity.employeeFullName || 'N/A'}</strong></>;
        case 'written_off': return <>Списано {assetInfo}</>;
        default: return 'Невідома дія';
    }
};


export default function DashboardPage() {
  // Fetch dashboard data using SWR
  const { data: dashboardData, error, isLoading } = useSWR<DashboardData>(
      '/api/dashboard/summary', // API endpoint URL
      fetcher, // The function to fetch the data
      { refreshInterval: 300000 } // Optional: Refresh data every 5 minutes
  );

    // Function to render the error message more clearly
  const renderErrorMessage = () => {
      let message = 'Перевірте з\'єднання або спробуйте пізніше.'; // Default message
      if (error) {
          if ((error as any).info?.message) {
              message = (error as any).info.message; // Use message from API if available
          } else if (error.message) {
              message = error.message; // Use generic error message
          }
      }
      return message;
  };


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
      {error && !isLoading && ( // Show error only if not loading
        <Alert severity="error" sx={{ mb: 3 }}>
          Не вдалося завантажити дані для дашборду.
          <Typography variant="caption" display="block">
             {renderErrorMessage()}
          </Typography>
        </Alert>
      )}


      {/* --- Data Display --- */}
      {!isLoading && !error && dashboardData && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
          }}
        >
          {/* --- First Flex Item (Low Stock Card) --- */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Card elevation={3} sx={{ height: '100%' }}>
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
                            // Removed legacyBehavior, passHref is usually sufficient
                            // Let NextLink render the <a> tag directly
                            <NextLink href={`/inventory?typeId=${item.assetTypeId}`} passHref>
                                <Link component="span" underline="hover" color="inherit" sx={{cursor: 'pointer'}}>
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
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Card elevation={3} sx={{ height: '100%' }}>
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
                    {/* Use activity.keySource for React key */}
                    {dashboardData.recentActivities.map((activity) => (
                      <ListItem key={activity.keySource} disableGutters divider>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {getActivityIcon(activity.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={getActivityDescription(activity)}
                          secondary={formatDate(activity.date as unknown as string)} // Cast date back to string for formatDate
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
