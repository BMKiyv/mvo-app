// pages/employees/index.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router';

// Import Modal components
import AddEmployeeModal from '@/components/AddEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';
import ProcessDeactivationAssetsModal from '@/components/ProcessDeactivationAssetsModal';

// --- Types ---
// Тип відповіді API для списку/оновлення/створення співробітника
type EmployeeApiResponse = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
};

// Тип відповіді від API деактивації
type EmployeeDeactivateResponseData = {
    id: number;
    is_active: boolean;
};

// *** ДОДАНО: Тип для помилки API ***
type ApiErrorData = {
    message: string;
    details?: any;
};


// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
    const router = useRouter();
    const { data: employees, error, isLoading } = useSWR<EmployeeApiResponse[]>('/api/employees', fetcher);

    // --- States ---
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [selectedEmployeeForMenu, setSelectedEmployeeForMenu] = React.useState<EmployeeApiResponse | null>(null);
    const menuOpen = Boolean(anchorEl);
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [addModalOpen, setAddModalOpen] = React.useState(false);
    const [employeeToEdit, setEmployeeToEdit] = React.useState<EmployeeApiResponse | null>(null);
    const [processAssetsModalOpen, setProcessAssetsModalOpen] = React.useState(false);
    const [employeeToProcess, setEmployeeToProcess] = React.useState<EmployeeApiResponse | null>(null);
    const [isDeactivating, setIsDeactivating] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);


    // --- Handlers for Action Menu ---
    const handleMenuClick = (event: React.MouseEvent<HTMLElement>, employee: EmployeeApiResponse) => {
        setAnchorEl(event.currentTarget);
        setSelectedEmployeeForMenu(employee);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // --- Handler for View Action ---
    const handleViewDetails = () => {
        if (selectedEmployeeForMenu && typeof selectedEmployeeForMenu.id === 'number') {
            const targetUrl = `/employees/${selectedEmployeeForMenu.id}`;
            router.push(targetUrl)
                .catch(err => {
                    console.error("Navigation error in router.push:", err);
                    setSnackbar({ open: true, message: `Помилка переходу: ${err.message}`, severity: 'error' });
                });
        } else {
            console.error("Cannot navigate: selectedEmployeeForMenu or its ID is invalid.", selectedEmployeeForMenu);
            setSnackbar({ open: true, message: 'Не вдалося отримати ID співробітника для перегляду.', severity: 'error' });
        }
        setAnchorEl(null); // Close menu
        setSelectedEmployeeForMenu(null); // Clear selection
    };

    // --- Handlers for Edit Modal ---
    const handleOpenEditModal = () => {
        if (selectedEmployeeForMenu) {
            setEmployeeToEdit(selectedEmployeeForMenu);
            setEditModalOpen(true);
        } else {
             console.error("Cannot open Edit Modal: selectedEmployeeForMenu is null.");
        }
        handleMenuClose();
    };
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

     // --- Handlers for Add Modal ---
     const handleOpenAddModal = () => { setAddModalOpen(true); };
     const handleCloseAddModal = () => { setAddModalOpen(false); };
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

    // --- Handlers for Deactivation Process ---
    const handleOpenProcessAssetsModal = () => {
        if (selectedEmployeeForMenu) {
            setEmployeeToProcess(selectedEmployeeForMenu);
            setProcessAssetsModalOpen(true);
        } else {
            console.error("Cannot open Process Assets Modal: selectedEmployeeForMenu is null.");
        }
        handleMenuClose();
    };

     const handleCloseProcessAssetsModal = () => {
        setProcessAssetsModalOpen(false);
        setEmployeeToProcess(null);
    };

    // This function is called by ProcessDeactivationAssetsModal when it's done
    const handleProcessingComplete = async (success: boolean, processedCount?: number) => {
        console.log(`Asset processing complete. Success: ${success}, Processed: ${processedCount}`);
        if (success && employeeToProcess) {
            setIsDeactivating(true);
            setSnackbar({ open: true, message: `Обробка активів завершена. Деактивація співробітника...`, severity: 'info' });
            try {
                const response = await fetch(`/api/employees/${employeeToProcess.id}`, { method: 'DELETE' });
                // Використовуємо ApiErrorData при обробці помилки
                const result: EmployeeDeactivateResponseData | ApiErrorData = await response.json();

                if (!response.ok) {
                    // Тепер message точно існує в ApiErrorData
                    throw new Error((result as ApiErrorData).message || `HTTP error! status: ${response.status}`);
                }

                mutate('/api/employees', (currentData: EmployeeApiResponse[] = []) => {
                    return currentData.filter(emp => emp && emp.id !== employeeToProcess.id);
                }, false);

                setSnackbar({ open: true, message: `Співробітника "${employeeToProcess.full_name}" успішно деактивовано.`, severity: 'success' });

            } catch (err) {
                console.error('Error during employee deactivation:', err);
                setSnackbar({ open: true, message: `Помилка деактивації співробітника: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
            } finally {
                setIsDeactivating(false);
                setEmployeeToProcess(null);
            }
        } else if (!success) {
             setSnackbar({ open: true, message: 'Не вдалося обробити активи. Деактивацію скасовано.', severity: 'error' });
             setEmployeeToProcess(null);
        } else {
             console.error("Processing complete but employeeToProcess is null.");
             setEmployeeToProcess(null);
        }
    };


     // --- Snackbar Close Handler ---
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
                <MenuItem onClick={handleOpenProcessAssetsModal} sx={{ color: 'warning.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'warning.main' }} /></ListItemIcon>
                    <ListItemText>Деактивувати (Звільнити)</ListItemText>
                </MenuItem>
            </Menu>

            {/* --- Modals --- */}
            {employeeToEdit && ( <EditEmployeeModal open={editModalOpen} onClose={handleCloseEditModal} employee={employeeToEdit} onSubmitSuccess={handleEditSuccess} /> )}
            <AddEmployeeModal open={addModalOpen} onClose={handleCloseAddModal} onSubmitSuccess={handleAddSuccess} />
            <ProcessDeactivationAssetsModal
                open={processAssetsModalOpen}
                onClose={handleCloseProcessAssetsModal}
                employeeId={employeeToProcess?.id ?? null}
                employeeName={employeeToProcess?.full_name || ''}
                onProcessingComplete={handleProcessingComplete}
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
