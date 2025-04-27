// pages/index.tsx (Дашборд)
'use client'; // Required for client-side hooks

import * as React from 'react';
import useSWR from 'swr';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
// import Grid from '@mui/material/Grid'; // Grid is not used for main layout here
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
import HistoryIcon from '@mui/icons-material/History'; // For recent activity title
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'; // Assigned
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn'; // Returned
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; // Written Off
import InventoryIcon from '@mui/icons-material/Inventory'; // For low stock title

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => { (error as any).info = info; throw error; })
                         .catch(() => { throw error; });
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

// Type RecentActivity with the correct field name 'activityType'
type RecentActivity = {
  activityType: 'assigned' | 'returned' | 'written_off'; // Correct field name
  date: string; // API returns date as string
  employeeFullName: string | null;
  assetTypeName: string | null;
  inventoryNumber: string | null;
  assetInstanceId: number;
  keySource: string; // Unique key source from API
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
const getActivityIcon = (type: RecentActivity['activityType']) => { // Parameter name is 'type'
    switch (type) { // Use the parameter 'type' here
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
            {/* TODO: Create page /inventory/instance/[id] */}
             <NextLink href={`/inventory/instance/${activity.assetInstanceId}`} passHref legacyBehavior>
                 <Link component="span" sx={{ fontWeight: 500 }} underline="hover" color="inherit">
                    {activity.assetTypeName || 'Невідомий тип'} ({activity.inventoryNumber || 'N/A'})
                 </Link>
             </NextLink>
        </Tooltip>
    );
     // TODO: Need employee ID from API to make this a link
     const employeeInfo = activity.employeeFullName ? (
         <span style={{ fontWeight: 'bold' }}>{activity.employeeFullName}</span>
        // <NextLink href={`/employees/${/* employee ID needed here */ ''}`} passHref legacyBehavior>
        //     <Link component="span" sx={{ fontWeight: 'bold' }} underline="hover" color="inherit">
        //         {activity.employeeFullName}
        //     </Link>
        // </NextLink>
     ) : 'N/A';

    // Use activity.activityType in the switch statement
    switch (activity.activityType) {
        case 'assigned': return <>Видано {assetInfo} співробітнику {employeeInfo}</>;
        case 'returned': return <>Повернено {assetInfo} від {employeeInfo}</>;
        case 'written_off': return <>Списано {assetInfo}</>;
        default:
             // Log the unexpected type value
             console.warn("Unknown activity type received in getActivityDescription:", `"${activity.activityType}"`, activity);
             return 'Невідома дія'; // Default text
    }
};


export default function DashboardPage() {
  const { data: dashboardData, error, isLoading } = useSWR<DashboardData>(
      '/api/dashboard/summary',
      fetcher,
      { refreshInterval: 300000 }
  );

    // Function to render the error message more clearly
  const renderErrorMessage = (error: any) => { // Pass error object
      let message = 'Перевірте з\'єднання або спробуйте пізніше.';
      if (error) {
          if ((error as any).info?.message) {
              message = (error as any).info.message;
          } else if (error.message) {
              message = error.message;
          }
      }
      return message;
  };


  // Log received data when it changes
  React.useEffect(() => {
      if (dashboardData?.recentActivities) {
          console.log("Received Recent Activities Data:", JSON.stringify(dashboardData.recentActivities, null, 2)); // Pretty print JSON
      }
       if (error) {
           console.error("Dashboard fetch error:", error);
       }
  }, [dashboardData, error]);


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
      {error && !isLoading && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Не вдалося завантажити дані для дашборду.
          <Typography variant="caption" display="block">
             {renderErrorMessage(error)} {/* Pass error to helper */}
          </Typography>
        </Alert>
      )}


      {/* --- Data Display --- */}
      {!isLoading && !error && dashboardData && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, }}>
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
          </Box>

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
                    {dashboardData.recentActivities.map((activity) => {
                        // console.log("Processing activity:", activity.activityType, activity); // Optional detailed log
                        return (
                          <ListItem key={activity.keySource} disableGutters divider>
                            <ListItemIcon sx={{ minWidth: 32, mt: 0.5, alignSelf: 'flex-start' }}>
                              {/* Pass activityType to the helper */}
                              {getActivityIcon(activity.activityType)}
                            </ListItemIcon>
                            <ListItemText
                              // Pass the whole activity object to the helper
                              primary={getActivityDescription(activity)}
                              secondary={formatDate(activity.date)}
                               primaryTypographyProps={{ variant: 'body2' }}
                               secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                            />
                          </ListItem>
                        );
                    })}
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
