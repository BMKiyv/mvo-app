// pages/inventory/write-off.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router';
import { useForm, Controller, SubmitHandler, useFieldArray } from 'react-hook-form';
import { CommissionRole } from '@prisma/client'; // Import Enum

// MUI Components
import Box from '@mui/material/Box'; // Use Box for layout
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
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormHelperText from '@mui/material/FormHelperText';
// Removed Grid import
// import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import Link from 'next/link';

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

// --- Types ---
type AssetTypeOption = { id: number; name: string; };
type CommissionMember = { id: number; full_name: string; position: string | null; commission_role: CommissionRole; };

type WriteOffItem = {
    assetTypeId: number | '';
    assetTypeName: string;
    quantity: number | string;
    reason?: string;
};

type WriteOffFormShape = {
    items: WriteOffItem[];
};

// Тип для Snackbar state, включаючи 'warning'
type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning'; // <--- Додано 'warning'
} | null;


// --- Компонент Сторінки Списання ---
export default function WriteOffPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();

    // --- State ---
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null); // <--- Використовуємо оновлений тип

    // --- Data Fetching ---
    const { data: assetTypes, error: assetTypesError } = useSWR<AssetTypeOption[]>('/api/asset-types', fetcher);
    const { data: commissionMembers, error: membersError } = useSWR<CommissionMember[]>('/api/employees/commission-members', fetcher);

    // --- React Hook Form ---
    const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<WriteOffFormShape>({
        defaultValues: { items: [] },
    });
    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchItems = watch("items");


    // --- Handlers ---
    const handleAddItem = () => {
        append({ assetTypeId: '', assetTypeName: '', quantity: '', reason: '' });
    };

    const handleRemoveItem = (index: number) => { remove(index); };

    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
    };

    // --- Generate Protocol (Placeholder) ---
    const handleGenerateProtocol = () => {
        const itemsToProcess = watchItems;
        if (!itemsToProcess || itemsToProcess.length === 0) {
            setSnackbar({ open: true, message: 'Додайте хоча б один актив до списку списання.', severity: 'info' });
            return;
        }
        if (!commissionMembers || commissionMembers.length < 2) {
             // Використовуємо 'warning' для цього повідомлення
             setSnackbar({ open: true, message: 'Не вдалося завантажити дані комісії або недостатньо членів.', severity: 'warning' });
            return;
        }
        console.log("--- Дані для Протоколу ---");
        console.log("Комісія:", commissionMembers);
        console.log("Активи до списання:", itemsToProcess);
        setSnackbar({ open: true, message: 'Дані для протоколу виведено в консоль (поки що).', severity: 'success' });
    };


    // --- Submit Write-Off ---
    const onSubmit: SubmitHandler<WriteOffFormShape> = async (data) => {
        if (!data.items || data.items.length === 0) {
             setSnackbar({ open: true, message: 'Список списання порожній.', severity: 'warning' }); // Використовуємо 'warning'
             return;
        }
        const invalidItem = data.items.find(item => !item.assetTypeId || !item.quantity || Number(item.quantity) <= 0);
        if (invalidItem) {
             setSnackbar({ open: true, message: 'Перевірте правильність заповнення всіх рядків (Тип та Кількість > 0).', severity: 'error' });
             return;
        }
        const confirmed = confirm(`Ви впевнені, що хочете підтвердити списання ${data.items.length} позицій?`);
        if (!confirmed) return;

        setIsSubmitting(true);
        setSnackbar(null);
        const payload = {
            items: data.items.map(item => ({
                assetTypeId: Number(item.assetTypeId),
                quantity: Number(item.quantity),
                reason: item.reason || null,
            })),
        };
        console.log("Submitting Write-Off:", payload);
        try {
            const response = await fetch('/api/inventory/perform-write-off', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.message || `HTTP error! status: ${response.status}`); }
            setSnackbar({ open: true, message: result.message || 'Списання успішно зафіксовано!', severity: 'success' });
            reset({ items: [] });
            // Можливо, оновити інші дані
            // mutate('/api/dashboard/summary');
            // mutate('/api/asset-types');
        } catch (err) {
            console.error("Write-off submission error:", err);
            setSnackbar({ open: true, message: `Помилка списання: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box>
            <Button component={Link} href="/inventory" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Назад до Інвентарю
            </Button>

            <Typography variant="h4" component="h1" gutterBottom>
                Списання Активів
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Додайте активи, які необхідно списати, вкажіть кількість та причину (необов'язково).
            </Typography>

            {/* --- Форма Додавання Рядків --- */}
            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Додати позицію до списання</Typography>
                <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleAddItem} sx={{ mb: 2 }} >
                    Додати Рядок
                </Button>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{width: '40%'}}>Тип Активу</TableCell>
                                <TableCell sx={{width: '15%'}} align="right">Кількість</TableCell>
                                <TableCell>Причина списання (необов'язково)</TableCell>
                                <TableCell align="right">Дія</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    {/* Вибір Типу Активу */}
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5}}>
                                        <Controller
                                            name={`items.${index}.assetTypeId`}
                                            control={control}
                                            defaultValue=""
                                            rules={{ required: 'Виберіть тип' }}
                                            render={({ field: selectField, fieldState }) => (
                                                <FormControl fullWidth error={!!fieldState.error || !!assetTypesError} size="small" disabled={!assetTypes}>
                                                    <Select {...selectField} displayEmpty>
                                                        <MenuItem value="" disabled>-- Тип --</MenuItem>
                                                        {assetTypes?.map((type) => ( <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem> ))}
                                                    </Select>
                                                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                                                    {assetTypesError && <FormHelperText error>Помилка завантаження типів</FormHelperText>}
                                                </FormControl>
                                            )}
                                        />
                                    </TableCell>
                                    {/* Кількість */}
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5}} align="right">
                                         <Controller
                                            name={`items.${index}.quantity`}
                                            control={control}
                                            defaultValue={1}
                                            rules={{ required: 'Введіть к-сть', min: { value: 1, message: 'Мін. 1' } }}
                                            render={({ field: qtyField, fieldState }) => ( <TextField {...qtyField} type="number" size="small" error={!!fieldState.error} helperText={fieldState.error?.message} InputProps={{ inputProps: { min: 1 } }} sx={{width: '80px'}} /> )}
                                        />
                                    </TableCell>
                                    {/* Причина */}
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5}}>
                                        <Controller name={`items.${index}.reason`} control={control} defaultValue="" render={({ field: reasonField }) => ( <TextField {...reasonField} size="small" fullWidth placeholder="Причина..."/> )} />
                                    </TableCell>
                                    {/* Кнопка Видалити */}
                                    <TableCell align="right" sx={{verticalAlign: 'top', pt: 1}}>
                                        <IconButton onClick={() => handleRemoveItem(index)} color="error" size="small"> <DeleteIcon /> </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                 {errors.items && ( <Alert severity="error" sx={{ mt: 2 }}>Будь ласка, заповніть всі необхідні поля в рядках списання.</Alert> )}
            </Paper>

             {/* --- Секція Комісії та Кнопки Дій (Використовуємо Box + Flexbox) --- */}
             <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 1 }}>
                {/* Список Членів Комісії */}
                <Box sx={{ flex: 1, minWidth: 0 }}> {/* Замість Grid item xs={12} md={5} */}
                     <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1}}>
                             <PeopleAltIcon sx={{ mr: 1, color: 'text.secondary' }} />
                             <Typography variant="h6">Комісія зі Списання</Typography>
                        </Box>
                        {membersError && <Alert severity="error" sx={{mt:1}}>Помилка завантаження членів комісії.</Alert>}
                        {!membersError && !commissionMembers && <CircularProgress size={20} />}
                        {commissionMembers && (
                            <List dense disablePadding>
                                {commissionMembers.filter(m => m.commission_role === CommissionRole.chair).map(m => ( <ListItem key={m.id} disablePadding><ListItemText primary={`${m.full_name} (Голова)`} secondary={m.position || 'Посада не вказана'} /></ListItem> ))}
                                {commissionMembers.filter(m => m.commission_role === CommissionRole.member).map(m => ( <ListItem key={m.id} disablePadding><ListItemText primary={`${m.full_name} (Член)`} secondary={m.position || 'Посада не вказана'}/></ListItem> ))}
                                {commissionMembers.length === 0 && <ListItem><ListItemText primary="Члени комісії не визначені." /></ListItem>}
                            </List>
                        )}
                    </Paper>
                </Box>

                 {/* Кнопки Дій */}
                 <Box sx={{ flex: 1.5, minWidth: 0 }}> {/* Замість Grid item xs={12} md={7} */}
                     <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection:'column', gap: 2, height: '100%' }}>
                        <Typography variant="h6">Дії</Typography>
                        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleGenerateProtocol} disabled={!watchItems || watchItems.length === 0 || !commissionMembers || isSubmitting} >
                            Сформувати Протокол (Консоль)
                        </Button>
                         <Button variant="contained" color="error" startIcon={<CheckCircleOutlineIcon />} onClick={handleSubmit(onSubmit)} disabled={!watchItems || watchItems.length === 0 || isSubmitting} >
                             {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Підтвердити Списання'}
                         </Button>
                         <Typography variant="caption" color="text.secondary">
                            Увага: Після підтвердження списання буде зафіксовано в системі.
                         </Typography>
                    </Paper>
                </Box>
            </Box>


             {/* --- Snackbar --- */}
           {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                 <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
               </Snackbar>
           )}
        </Box>
    );
}
