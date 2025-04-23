// pages/employees/[id].tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import useSWR, { useSWRConfig } from 'swr'; // Import useSWRConfig for mutate

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert'; // Import Alert
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar'; // For notifications

// MUI Icons
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link'; // Use NextLink for navigation

// Import the Issue Asset Modal component
import IssueAssetModal from '../../components/IssueAssetModal'; // Adjust path if necessary

// --- Fetcher function ---
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        try { (error as any).info = await res.json(); } catch (e) { /* Ignore */ }
        (error as any).status = res.status;
        throw error;
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return res.json();
};

// --- Types from API ---
type EmployeeDetailsData = {
  id: number; full_name: string; position: string | null; contact_info: string | null;
  is_active: boolean; is_responsible: boolean; created_at: string;
};
type AssignedAssetData = {
  instanceId: number; inventoryNumber: string; assetTypeName: string;
};
// Type for the data returned by the assign API
type AssignedInstanceData = {
    id: number;
    assetTypeName?: string;
    inventoryNumber: string;
    // Add other fields if returned by API and needed
};

// Define the type for Snackbar state, including 'warning' severity
type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning'; // Added 'warning'
} | null;


export default function EmployeeDetailPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig(); // Get mutate function from SWR
  const { id } = router.query;
  const employeeId = typeof id === 'string' ? parseInt(id, 10) : null;

  // --- State for Issue Asset Modal ---
  const [isIssueModalOpen, setIsIssueModalOpen] = React.useState(false);
  // --- State for Snackbar Notifications (using updated type) ---
  const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);


  // Fetch employee details
  const employeeDetailsUrl = employeeId ? `/api/employees/${employeeId}` : null;
  const { data: employee, error: employeeError, isLoading: isLoadingEmployee } = useSWR<EmployeeDetailsData>(
    employeeDetailsUrl,
    fetcher
  );

  // Fetch assigned assets
  const assignedAssetsUrl = employeeId ? `/api/employees/${employeeId}/assets` : null;
  const { data: assets, error: assetsError, isLoading: isLoadingAssets } = useSWR<AssignedAssetData[]>(
    assignedAssetsUrl,
    fetcher
  );

  // --- Handlers ---
  const handleOpenIssueModal = () => {
      if (employee && employee.is_active) { // Open only if employee data loaded and active
          setIsIssueModalOpen(true);
      } else if (employee && !employee.is_active) {
          // Show warning if employee is inactive
          setSnackbar({ open: true, message: 'Неможливо видати актив неактивному співробітнику.', severity: 'warning' }); // Use 'warning'
      } else {
           // Handle case where employee data might not be loaded yet
           setSnackbar({ open: true, message: 'Дані співробітника ще завантажуються.', severity: 'info' });
      }
  };

  const handleCloseIssueModal = () => {
    setIsIssueModalOpen(false);
  };

  // Handler for successful asset assignment
  const handleIssueSuccess = (assignedAsset: AssignedInstanceData) => {
      setSnackbar({ open: true, message: `Актив "${assignedAsset.assetTypeName || assignedAsset.inventoryNumber}" успішно видано!`, severity: 'success' });
      // Revalidate the assigned assets list to show the newly added item
      if (assignedAssetsUrl) {
          mutate(assignedAssetsUrl);
      }
      // Modal is closed by the IssueAssetModal component itself
  };

   // --- Snackbar Close Handler ---
   const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar(null);
  };

  // --- Render Loading ---
  if (isLoadingEmployee || (employeeId && isLoadingAssets && !assets && !assetsError)) { // Adjusted loading condition
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // --- Render Error for Employee ---
   if (employeeError) {
     return (
         <Box>
             <Button component={Link} href="/employees" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                 До списку співробітників
             </Button>
             <Alert severity="error">
                Не вдалося завантажити дані співробітника. {(employeeError as any).info?.message || employeeError.message}
             </Alert>
         </Box>
     );
   }
   // --- Render Not Found for Employee ---
   if (!employee) {
        return (
             <Box>
                <Button component={Link} href="/employees" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                    До списку співробітників
                </Button>
                <Alert severity="warning">Співробітника не знайдено або він неактивний.</Alert>
            </Box>
        );
   }

  // --- Render Content ---
  return (
    <Box>
        <Button component={Link} href="/employees" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
             До списку співробітників
         </Button>
      {/* --- Employee Info Section --- */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
         {/* Employee details rendering */}
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
            {employee.full_name}
            </Typography>
            <Box>
                 {employee.is_responsible && <Chip label="Відповідальна особа" color="primary" size="small" sx={{ mr: 1 }} />}
                 <Chip label={employee.is_active ? "Активний" : "Неактивний"} color={employee.is_active ? "success" : "default"} size="small" />
            </Box>
        </Box>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {employee.position || '(Посада не вказана)'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {employee.contact_info || '(Контактна інформація не вказана)'}
        </Typography>
         <Typography variant="caption" color="text.secondary" display="block" sx={{mt: 1}}>
          Зареєстровано: {new Date(employee.created_at).toLocaleDateString('uk-UA')}
        </Typography>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* --- Assigned Assets Section --- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Виданий Інвентар
        </Typography>
        {/* Show button only if employee is active */}
        {employee.is_active && (
            <Button
                variant="contained"
                startIcon={<AddShoppingCartIcon />}
                onClick={handleOpenIssueModal}
                >
                Видати Інвентар
            </Button>
        )}
      </Box>

      {/* Asset Loading/Error */}
       {isLoadingAssets && !assets && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto' }} />}
       {assetsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
                Не вдалося завантажити список активів. {(assetsError as any).info?.message || assetsError.message}
            </Alert>
       )}

      {/* Asset Table/Message */}
      {!isLoadingAssets && assets && (
        assets.length === 0 ? (
          <Typography sx={{ textAlign: 'center', mt: 3, color: 'text.secondary' }}>
            Поки нічого не видавали.
          </Typography>
        ) : (
          <TableContainer component={Paper} elevation={2}>
            <Table sx={{ minWidth: 650 }} aria-label="assigned assets table">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell>Назва Активу</TableCell>
                  <TableCell>Інвентарний Номер</TableCell>
                  {/* <TableCell>Дата Видачі</TableCell> */}
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.instanceId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">{asset.assetTypeName}</TableCell>
                    <TableCell>{asset.inventoryNumber}</TableCell>
                    {/* <TableCell>{asset.assignmentDate ? new Date(asset.assignmentDate).toLocaleDateString('uk-UA') : 'N/A'}</TableCell> */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

       {/* --- Issue Asset Modal --- */}
       {/* Render the modal and control its visibility with state */}
       <IssueAssetModal
            open={isIssueModalOpen}
            onClose={handleCloseIssueModal}
            employeeId={employeeId} // Pass the current employee's ID
            employeeName={employee?.full_name || ''} // Pass the name for the title
            onSubmitSuccess={handleIssueSuccess} // Pass the success handler
       />

        {/* --- Snackbar for Notifications --- */}
       {snackbar && (
           <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
             {/* Ensure Alert component can handle the severity passed */}
             <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
               {snackbar.message}
             </Alert>
           </Snackbar>
       )}

    </Box>
  );
}
