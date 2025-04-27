// pages/inventory/write-off.tsx
'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/router';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox'; // Для вибору рядків
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'; // Іконка для списання
import Link from 'next/link';
import Snackbar from '@mui/material/Snackbar';

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => { (error as any).info = info; throw error; })
                         .catch(() => { throw error; });
    }
    return res.json();
});

// --- Типи Даних ---
// Тип для активів, які можна списати (з API)
type WriteOffCandidate = {
    instanceId: number;
    inventoryNumber: string;
    assetTypeName: string;
    status: string; // Поточний статус ('on_stock', 'issued', etc.)
    employeeFullName: string | null; // Хто тримає, якщо 'issued'
    quantity: number; // Важливо, якщо списуємо з партії
    // Додайте інші поля, якщо потрібно для вибору (напр., дата покупки)
};

// --- Компонент Сторінки Списання ---
export default function WriteOffPage() {
    const router = useRouter();
    const [selectedInstances, setSelectedInstances] = React.useState<Set<number>>(new Set()); // Зберігаємо ID вибраних екземплярів
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' } | null>(null);

    // TODO: Створити API /api/asset-instances/write-off-candidates
    // Поки що використовуємо заглушку URL
    const apiUrl = '/api/asset-instances/write-off-candidates'; // Замініть на реальний URL, коли створите API
    const { data: candidates, error, isLoading } = useSWR<WriteOffCandidate[]>(apiUrl, fetcher);

    // --- Обробники ---
    const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked && candidates) {
            const newSelecteds = new Set(candidates.map((n) => n.instanceId));
            setSelectedInstances(newSelecteds);
            return;
        }
        setSelectedInstances(new Set());
    };

    const handleSelectClick = (event: React.MouseEvent<unknown>, id: number) => {
        const selectedIndex = selectedInstances.has(id);
        const newSelected = new Set(selectedInstances);

        if (selectedIndex) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedInstances(newSelected);
    };

    const handleWriteOffClick = async () => {
        if (selectedInstances.size === 0) {
            setSnackbar({ open: true, message: 'Будь ласка, виберіть хоча б один актив для списання.', severity: 'info' });
            return;
        }

        const confirmed = confirm(`Ви впевнені, що хочете списати ${selectedInstances.size} актив(ів)? Цю дію не можна буде скасувати легко.`);
        if (!confirmed) return;

        setIsSubmitting(true);
        setSnackbar(null);

        try {
            // TODO: Створити API POST /api/asset-instances/write-off-batch
            console.log("Attempting to write off IDs:", Array.from(selectedInstances));
            // const response = await fetch('/api/asset-instances/write-off-batch', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ instanceIds: Array.from(selectedInstances) }),
            // });
            // const result = await response.json();
            // if (!response.ok) {
            //     throw new Error(result.message || 'Помилка списання активів');
            // }

            // Тимчасова заглушка успіху
            await new Promise(resolve => setTimeout(resolve, 1000)); // Імітація запиту
            // --- Кінець заглушки ---

            setSnackbar({ open: true, message: `${selectedInstances.size} актив(ів) успішно списано.`, severity: 'success' });
            setSelectedInstances(new Set()); // Очищуємо вибір
            // Оновити дані в таблиці (якщо потрібно)
            // mutate(apiUrl);

        } catch (err) {
             console.error("Write-off error:", err);
             setSnackbar({ open: true, message: `Помилка списання: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
             setIsSubmitting(false);
        }
    };

    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
    };

    const isSelected = (id: number) => selectedInstances.has(id);
    const numSelected = selectedInstances.size;
    const rowCount = candidates?.length ?? 0;

    return (
        <Box>
            <Button component={Link} href="/inventory" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Назад до Інвентарю
            </Button>

            <Typography variant="h4" component="h1" gutterBottom>
                Списання Активів
            </Typography>

            {/* --- Loading State --- */}
            {isLoading && ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box> )}
            {/* --- Error State --- */}
            {error && !isLoading && ( <Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити активи для списання. {(error as any).info?.message || error.message} </Alert> )}

            {/* --- Data Table --- */}
            {!isLoading && !error && candidates && (
                 <Paper sx={{ width: '100%', mb: 2 }} elevation={3}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                         <Typography variant="h6">
                             Виберіть активи для списання ({numSelected} вибрано)
                         </Typography>
                         <Button
                            variant="contained"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            onClick={handleWriteOffClick}
                            disabled={numSelected === 0 || isSubmitting}
                         >
                             {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Списати Вибране'}
                         </Button>
                     </Box>
                    <TableContainer>
                        <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
                            <TableHead sx={{ backgroundColor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            color="primary"
                                            indeterminate={numSelected > 0 && numSelected < rowCount}
                                            checked={rowCount > 0 && numSelected === rowCount}
                                            onChange={handleSelectAllClick}
                                            inputProps={{ 'aria-label': 'select all assets' }}
                                        />
                                    </TableCell>
                                    <TableCell>Інв. Номер</TableCell>
                                    <TableCell>Назва Типу</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>К-сть</TableCell>
                                    <TableCell>Поточний власник</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {candidates.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} align="center">Немає активів для списання.</TableCell></TableRow>
                                ) : (
                                    candidates.map((row) => {
                                        const isItemSelected = isSelected(row.instanceId);
                                        const labelId = `write-off-table-checkbox-${row.instanceId}`;
                                        return (
                                            <TableRow
                                                hover
                                                onClick={(event) => handleSelectClick(event, row.instanceId)}
                                                role="checkbox"
                                                aria-checked={isItemSelected}
                                                tabIndex={-1}
                                                key={row.instanceId}
                                                selected={isItemSelected}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        color="primary"
                                                        checked={isItemSelected}
                                                        inputProps={{ 'aria-labelledby': labelId }}
                                                    />
                                                </TableCell>
                                                <TableCell component="th" id={labelId} scope="row">{row.inventoryNumber}</TableCell>
                                                <TableCell>{row.assetTypeName}</TableCell>
                                                <TableCell>{row.status}</TableCell> {/* TODO: Translate status? */}
                                                <TableCell align="right">{row.quantity}</TableCell>
                                                <TableCell>{row.employeeFullName ?? '-'}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                 </Paper>
            )}

             {/* --- Snackbar --- */}
           {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                 <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
               </Snackbar>
           )}
        </Box>
    );
}
