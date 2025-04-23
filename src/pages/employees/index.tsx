// pages/employees/index.tsx
'use client'; // <--- ДОДАЙТЕ ЦЕЙ РЯДОК НА САМОМУ ПОЧАТКУ ФАЙЛУ

import * as React from 'react';
import useSWR from 'swr'; // Import SWR
// Import the specific type returned by your API if needed, or use a generic type
// import { EmployeeSelectedData } from '../api/employees'; // Assuming you export the type
type EmployeeSelectedData = { // Or define it directly here
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  is_active: boolean;
  is_responsible: boolean;
};


// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline'; // Use Outline for less emphasis
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress'; // Loading indicator
import Alert from '@mui/material/Alert'; // Error display
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

// --- Fetcher function for SWR ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        // error.info = await res.json(); // Potentially get more info
        (error as any).status = res.status; // Add status to error object
        throw error;
    }
    return res.json();
});


export default function EmployeesPage() { // Function MUST NOT be async
  // --- SWR Hook for data fetching ---
  const { data: employees, error, isLoading, mutate } = useSWR<EmployeeSelectedData[]>('/api/employees', fetcher); // Use the correct type

  // --- State for Action Menu ---
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedEmployee, setSelectedEmployee] = React.useState<EmployeeSelectedData | null>(null); // Use the correct type
  const open = Boolean(anchorEl);

  // --- Handlers for Action Menu ---
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, employee: EmployeeSelectedData) => { // Use the correct type
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmployee(null);
  };

  // --- Placeholder Handlers for Actions ---
  const handleAddEmployee = () => {
    console.log("Open Add Employee Modal");
    // TODO: Implement logic to open an "Add Employee" modal/dialog
    // After successful addition, you might want to refresh the data:
    // mutate(); // Re-fetches data for the '/api/employees' key
  };

  const handleEdit = () => {
    if (selectedEmployee) {
      console.log("Open Edit Modal for:", selectedEmployee.full_name);
      // TODO: Implement logic to open an "Edit Employee" modal/dialog with selectedEmployee data
      // After successful edit, you might want to refresh the data:
      // mutate();
    }
    handleMenuClose();
  };

  const handleDelete = async () => { // Make handler async if performing async operations
    if (selectedEmployee) {
      console.log("Attempting to delete:", selectedEmployee.full_name);
      // TODO: Implement logic to show a confirmation dialog
      const confirmed = confirm(`Ви впевнені, що хочете видалити співробітника ${selectedEmployee.full_name}?`); // Simple confirmation

      if (confirmed) {
          try {
              // TODO: Create the DELETE API endpoint: /api/employees/[id].ts
              const response = await fetch(`/api/employees/${selectedEmployee.id}`, {
                  method: 'DELETE',
              });

              if (!response.ok) {
                  // Handle API error (e.g., show notification)
                  const errorData = await response.json();
                  console.error('Failed to delete employee:', errorData.message);
                  alert(`Помилка видалення: ${errorData.message || response.statusText}`);
              } else {
                  // Option 1: Revalidate SWR data (makes another GET request)
                  mutate();
                  // Option 2: Optimistic update (faster UI, more complex)
                  // mutate(employees?.filter(emp => emp.id !== selectedEmployee.id), false); // Update local data immediately
                  console.log('Employee deleted successfully');
              }
          } catch (err) {
              console.error('Error during delete request:', err);
              alert('Сталася помилка під час видалення.');
          }
      }
    }
    handleMenuClose();
  };

  // --- Render Logic ---

  return (
    <Box>
      {/* --- Page Header --- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Співробітники
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEmployee}
        >
          Додати Співробітника
        </Button>
      </Box>

      {/* --- Loading State --- */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <CircularProgress />
        </Box>
      )}

      {/* --- Error State --- */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не вдалося завантажити список співробітників. Помилка: {error.status || error.message}
        </Alert>
      )}

      {/* --- Data Table --- */}
      {!isLoading && !error && employees && (
        <TableContainer component={Paper} elevation={3}>
          <Table sx={{ minWidth: 650 }} aria-label="simple employees table">
            {/* --- Table Header --- */}
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>ПІБ</TableCell>
                <TableCell>Посада</TableCell>
                <TableCell>Контактна інформація</TableCell>
                <TableCell align="right">Дії</TableCell>
              </TableRow>
            </TableHead>
            {/* --- Table Body --- */}
            <TableBody>
              {employees.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={4} align="center">
                       Активних співробітників не знайдено.
                    </TableCell>
                 </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    hover
                  >
                    <TableCell component="th" scope="row">
                      {employee.full_name}
                    </TableCell>
                    <TableCell>{employee.position ?? 'N/A'}</TableCell>
                    <TableCell>{employee.contact_info ?? 'N/A'}</TableCell>
                    {/* --- Action Menu Button --- */}
                    <TableCell align="right">
                      <IconButton
                        aria-label="more actions"
                        aria-controls={open && selectedEmployee?.id === employee.id ? 'employee-actions-menu' : undefined}
                        aria-expanded={open && selectedEmployee?.id === employee.id ? 'true' : undefined}
                        aria-haspopup="true"
                        onClick={(event) => handleMenuClick(event, employee)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- Action Menu --- */}
      <Menu
        id="employee-actions-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Редагувати</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }}/>
          </ListItemIcon>
          <ListItemText>Видалити</ListItemText>
        </MenuItem>
      </Menu>

    </Box>
  );
}
