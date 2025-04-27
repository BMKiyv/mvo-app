// pages/employees/index.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router'; // Import useRouter for navigation
// Переконайтесь, що шляхи до модальних вікон правильні
import AddEmployeeModal from '@/components/AddEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';

// Import the specific type returned by your API
type EmployeeApiResponse = {
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
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility'; // Import View icon
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Snackbar from '@mui/material/Snackbar';


// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => {
            (error as any).info = info; throw error;
        }).catch(() => { throw error; });
    }
    return res.json();
});


export default function EmployeesPage() {
    const { mutate } = useSWRConfig();
    const router = useRouter(); // Initialize router
    const { data: employees, error, isLoading } = useSWR<EmployeeApiResponse[]>('/api/employees', fetcher);

    // --- State for Action Menu ---
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [selectedEmployeeForMenu, setSelectedEmployeeForMenu] = React.useState<EmployeeApiResponse | null>(null);
    const menuOpen = Boolean(anchorEl);

    // --- State for Modals ---
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [addModalOpen, setAddModalOpen] = React.useState(false);
    const [employeeToEdit, setEmployeeToEdit] = React.useState<EmployeeApiResponse | null>(null);

    // --- State for Snackbar Notifications ---
    const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' } | null>(null);


    // --- Handlers for Action Menu ---
    const handleMenuClick = (event: React.MouseEvent<HTMLElement>, employee: EmployeeApiResponse) => {
        console.log("Menu clicked for:", employee);
        setAnchorEl(event.currentTarget);
        setSelectedEmployeeForMenu(employee);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
        // Don't clear selectedEmployeeForMenu here immediately
    };

    // --- Handler for View Action ---
    const handleViewDetails = () => {
        console.log("handleViewDetails called.");
        console.log("Current selectedEmployeeForMenu:", selectedEmployeeForMenu);

        if (selectedEmployeeForMenu && typeof selectedEmployeeForMenu.id === 'number') {
            const targetUrl = `/employees/${selectedEmployeeForMenu.id}`;
            console.log("Attempting to navigate to:", targetUrl);
            router.push(targetUrl)
                .then((success) => {
                    if (success) { console.log("Navigation successful!"); }
                    else { console.warn("Navigation returned false, possibly interrupted."); }
                })
                .catch(err => {
                    console.error("Navigation error in router.push:", err);
                    setSnackbar({ open: true, message: `Помилка переходу: ${err.message}`, severity: 'error' });
                });
        } else {
            console.error("Cannot navigate: selectedEmployeeForMenu or its ID is invalid.", selectedEmployeeForMenu);
            setSnackbar({ open: true, message: 'Не вдалося отримати ID співробітника для перегляду.', severity: 'error' });
        }
        // Close menu AFTER navigation attempt
        setAnchorEl(null);
        setSelectedEmployeeForMenu(null); // Clear selection here
    };

    // --- Handlers for Edit Modal ---
    const handleOpenEditModal = () => {
        if (selectedEmployeeForMenu) {
            setEmployeeToEdit(selectedEmployeeForMenu);
            setEditModalOpen(true);
        } else {
             console.error("Cannot open Edit Modal: selectedEmployeeForMenu is null.");
        }
        handleMenuClose(); // Close the menu itself
    };
    // *** ВИДАЛЕНО ЗАГЛУШКИ ЗВІДСИ ***

    // --- Re-add implementations for handlers (ЗАЛИШЕНО ТІЛЬКИ РЕАЛІЗАЦІЇ) ---
     const handleCloseEditModal = () => {
        setEditModalOpen(false);
        setEmployeeToEdit(null);
     };
     const handleEditSuccess = (updatedEmployee: EmployeeApiResponse) => {
        mutate('/api/employees', (currentData: EmployeeApiResponse[] = []) => {
            if (!updatedEmployee?.id) return currentData;
            return currentData.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp);
        }, false);
        setSnackbar({ open: true, message: `Дані співробітника ${updatedEmployee?.full_name || ''} оновлено!`, severity: 'success' });
     };
     const handleOpenAddModal = () => {
        setAddModalOpen(true);
     };
     const handleCloseAddModal = () => {
        setAddModalOpen(false);
     };
     const handleAddSuccess = (newEmployee: EmployeeApiResponse) => {
        if (!newEmployee || !newEmployee.full_name) {
            console.error("handleAddSuccess received invalid newEmployee:", newEmployee);
            setSnackbar({ open: true, message: 'Помилка оновлення списку після додавання.', severity: 'error' });
            mutate('/api/employees');
            return;
        }
        mutate('/api/employees', (currentData: EmployeeApiResponse[] = []) => {
            const validData = currentData.filter(emp => emp && emp.full_name);
            const updatedData = [...validData, newEmployee];
            return updatedData.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        }, false);
        setSnackbar({ open: true, message: `Співробітника "${newEmployee.full_name}" успішно додано!`, severity: 'success' });
     };
     const handleDelete = async () => {
        const employeeToDelete = selectedEmployeeForMenu;
        setAnchorEl(null); // Close menu immediately

        if (employeeToDelete) {
          const confirmed = confirm(`Ви впевнені, що хочете деактивувати співробітника ${employeeToDelete.full_name}? Активи будуть повернуті на склад.`);
          if (confirmed) {
              try {
                  const response = await fetch(`/api/employees/${employeeToDelete.id}`, { method: 'DELETE' });
                  if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                  }
                  mutate('/api/employees', (currentData: EmployeeApiResponse[] = []) => {
                       return currentData.filter(emp => emp && emp.id !== employeeToDelete.id);
                  }, false);
                  setSnackbar({ open: true, message: 'Співробітника деактивовано.', severity: 'success' });
              } catch (err) {
                  console.error('Error during delete request:', err);
                   setSnackbar({ open: true, message: `Помилка видалення: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
              }
          }
        } else {
             console.error("Delete failed: selectedEmployeeForMenu was null");
        }
        setSelectedEmployeeForMenu(null); // Clear selection after operations
     };
     const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
     };


    // --- Render Logic ---
    return (
        <Box>
            {/* --- Page Header --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Співробітники
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddModal}>
                    Додати Співробітника
                </Button>
            </Box>

            {/* Loading/Error States */}
            {isLoading && (<Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>)}
            {error && (<Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити список співробітників. {(error as any).info?.message || error.message} </Alert>)}

            {/* --- Data Table --- */}
            {!isLoading && !error && employees && (
                <TableContainer component={Paper} elevation={3}>
                    <Table sx={{ minWidth: 650 }} aria-label="simple employees table">
                        <TableHead sx={{ backgroundColor: 'action.hover' }}>
                            <TableRow>
                                <TableCell>ПІБ</TableCell>
                                <TableCell>Посада</TableCell>
                                <TableCell>Контактна інформація</TableCell>
                                <TableCell align="right">Дії</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employees.length === 0 ? (
                                <TableRow><TableCell colSpan={4} align="center">Активних співробітників не знайдено.</TableCell></TableRow>
                            ) : (
                                employees.filter(emp => emp && emp.id).map((employee) => (
                                    <TableRow key={employee.id} hover>
                                        <TableCell component="th" scope="row">{employee.full_name}</TableCell>
                                        <TableCell>{employee.position ?? 'N/A'}</TableCell>
                                        <TableCell>{employee.contact_info ?? 'N/A'}</TableCell>
                                        <TableCell align="right">
                                            <IconButton aria-label="actions" onClick={(event) => handleMenuClick(event, employee)}>
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
            <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
                <MenuItem onClick={handleViewDetails}>
                    <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Переглянути</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleOpenEditModal}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Редагувати</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                    <ListItemText>Деактивувати</ListItemText>
                </MenuItem>
            </Menu>

            {/* --- Modals --- */}
            {employeeToEdit && (
                <EditEmployeeModal
                    open={editModalOpen}
                    onClose={handleCloseEditModal}
                    employee={employeeToEdit}
                    onSubmitSuccess={handleEditSuccess}
                />
            )}
            <AddEmployeeModal
                open={addModalOpen}
                onClose={handleCloseAddModal}
                onSubmitSuccess={handleAddSuccess}
            />
            {/* --- Snackbar --- */}
            {snackbar && (
                <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                    <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
        </Box>
    );
}
