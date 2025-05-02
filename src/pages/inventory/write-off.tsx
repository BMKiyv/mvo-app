// pages/inventory/write-off.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router';
// Removed unused react-hook-form imports
import { CommissionRole, AssetStatus } from '@prisma/client';

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
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ArticleIcon from '@mui/icons-material/Article';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
// Removed unused icons
// import DeleteIcon from '@mui/icons-material/DeleteOutline';
// import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Link from 'next/link';

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => { (error as any).info = info; throw error; })
                         .catch(() => { throw error; });
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return [];
    return res.json();
});

// --- Types ---
type AssetCategoryOption = { id: number; name: string; };
type CommissionMember = { id: number; full_name: string; position: string | null; commission_role: CommissionRole; };
type WriteOffCandidate = {
    instanceId: number; inventoryNumber: string; assetTypeName: string;
    assetTypeId: number; unitOfMeasure: string; status: AssetStatus;
    employeeFullName: string | null; quantity: number; purchase_date: string;
    unit_cost: string; notes?: string | null; categoryName: string | null;
};
type SelectedWriteOffItem = {
    instanceId: number; assetTypeId: number; assetTypeName: string;
    unitOfMeasure: string; quantityToWriteOff: number | string;
    reason: string; inventoryNumber: string; unitCost: string;
    availableQuantity: number;
};
type GenerateProtocolDto = { items: { instanceId: number; assetTypeId: number; assetTypeName: string; unitOfMeasure: string; inventoryNumber: string; quantity: number; reason: string | null; unitCost?: string; }[]; };
type SignatoryData = { full_name: string; position: string | null; role?: CommissionRole; };
type ProtocolItemData = { assetTypeName: string; quantity: number; reason: string | null; assetTypeId: number; unitOfMeasure: string; unitCost?: string; inventoryNumber: string; };
type ProtocolDataResponse = { protocolDate: string; organizationName: string; organizationCode: string; headOfEnterprise: SignatoryData | null; chiefAccountant: SignatoryData | null; responsiblePerson: SignatoryData | null; commission: { chair: SignatoryData | null; members: SignatoryData[]; }; items: ProtocolItemData[]; };
type PerformWriteOffPayloadItem = { instanceId: number; quantityToWriteOff: number; reason: string | null; };
type PerformWriteOffPayload = { items: PerformWriteOffPayloadItem[]; };
type PerformWriteOffResponse = { message: string; createdLogEntries?: number; };
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;
type ApiErrorData = { message: string; details?: any };

// *** ДОДАНО: Інтерфейс для пропсів WriteOffRow ***
interface WriteOffRowProps {
    candidate: WriteOffCandidate;
    isSelected: boolean;
    selectionData: SelectedWriteOffItem | undefined;
    inputError: string | undefined;
    onCheckboxChange: (event: React.ChangeEvent<HTMLInputElement>, candidate: WriteOffCandidate) => void;
    onQuantityChange: (instanceId: number, value: string) => void;
    onReasonChange: (instanceId: number, value: string) => void;
}

// --- Мемоізований Компонент Рядка Таблиці ---
// Визначення поза основним компонентом
const WriteOffRow: React.FC<WriteOffRowProps> = React.memo(({
    candidate,
    isSelected, // Використовуємо isSelected
    selectionData,
    inputError,
    onCheckboxChange,
    onQuantityChange,
    onReasonChange
}) => {
    return (
        <TableRow hover selected={isSelected}>
            <TableCell padding="checkbox"> <Checkbox color="primary" checked={isSelected} onChange={(event) => onCheckboxChange(event, candidate)} /> </TableCell>
            <TableCell sx={{fontWeight: 500}}>{candidate.inventoryNumber}</TableCell>
            <TableCell>{candidate.assetTypeName}</TableCell>
            <TableCell>{candidate.status}</TableCell>
            <TableCell>{candidate.employeeFullName ?? '-'}</TableCell>
            <TableCell align="right">{candidate.quantity}</TableCell>
            <TableCell align="center">
                <TextField type="number" size="small"
                    value={isSelected ? selectionData?.quantityToWriteOff ?? '' : ''}
                    onChange={(e) => onQuantityChange(candidate.instanceId, e.target.value)}
                    disabled={!isSelected}
                    InputProps={{ inputProps: { min: 1, max: candidate.quantity } }}
                    sx={{ width: '80px' }}
                    error={!!inputError}
                    helperText={inputError || ''}
                />
            </TableCell>
            <TableCell> <TextField size="small" fullWidth placeholder="Причина..." value={isSelected ? selectionData?.reason ?? '' : ''} onChange={(e) => onReasonChange(candidate.instanceId, e.target.value)} disabled={!isSelected} /> </TableCell>
        </TableRow>
    );
});
WriteOffRow.displayName = 'WriteOffRow';


// --- Компонент Сторінки Списання ---
export default function WriteOffPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();

    // --- State ---
    const [selectedInstances, setSelectedInstances] = React.useState<Map<number, SelectedWriteOffItem>>(new Map());
    const [isGeneratingProtocol, setIsGeneratingProtocol] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);
    const [inputErrors, setInputErrors] = React.useState<{[key: number]: string | undefined}>({});
    const [filterCategory, setFilterCategory] = React.useState<string>('');
    const [searchTerm, setSearchTerm] = React.useState<string>('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState<string>('');

    // --- Debounce Search Term ---
    React.useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 500);
        return () => { clearTimeout(handler); };
    }, [searchTerm]);

    // --- Data Fetching ---
    const { data: categories, error: categoriesError } = useSWR<AssetCategoryOption[]>('/api/asset-categories', fetcher);
    const { data: commissionMembers, error: membersError } = useSWR<CommissionMember[]>('/api/employees/commission-members', fetcher);
    const candidatesUrl = React.useMemo(() => {
        const params = new URLSearchParams();
        if (filterCategory) params.append('categoryId', filterCategory);
        if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
        return `/api/asset-instances/write-off-candidates?${params.toString()}`;
    }, [filterCategory, debouncedSearchTerm]);
    const { data: candidates, error: candidatesError, isLoading: isLoadingCandidates } = useSWR<WriteOffCandidate[]>(
        candidatesUrl, fetcher, { revalidateOnFocus: false }
    );
    // *** ВИДАЛЕНО ЗАЙВИЙ ЗАПИТ assetTypes ***


    // --- Handlers ---
    const handleCloseSnackbar = React.useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
    }, []);

    const handleCheckboxChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>, candidate: WriteOffCandidate) => {
        const instanceId = candidate.instanceId;
        setSelectedInstances(prevSelected => {
            const newSelected = new Map(prevSelected);
            if (event.target.checked) {
                newSelected.set(instanceId, {
                    instanceId: instanceId,
                    assetTypeId: candidate.assetTypeId,
                    assetTypeName: candidate.assetTypeName,
                    unitOfMeasure: candidate.unitOfMeasure,
                    quantityToWriteOff: 1,
                    reason: '',
                    inventoryNumber: candidate.inventoryNumber,
                    unitCost: candidate.unit_cost,
                    availableQuantity: candidate.quantity,
                });
            } else {
                newSelected.delete(instanceId);
            }
            return newSelected;
        });
         setInputErrors(prev => {
             const newErrors = {...prev};
             delete newErrors[instanceId];
             return newErrors;
         });
    }, []);

    const handleQuantityChange = React.useCallback((instanceId: number, value: string) => {
        setSelectedInstances(prevSelected => {
            const currentItem = prevSelected.get(instanceId);
            if (!currentItem) return prevSelected;
            const newSelected = new Map(prevSelected);
            let quantityToWriteOff: number | string = 1;
            let error: string | undefined = undefined;
            if (value.trim() === '') {
                 quantityToWriteOff = ''; error = 'К-сть обов\'язкова';
            } else {
                const numValue = parseInt(value, 10);
                if (isNaN(numValue) || numValue < 1) { quantityToWriteOff = value; error = 'Мін. 1'; }
                else if (numValue > currentItem.availableQuantity) { quantityToWriteOff = currentItem.availableQuantity; error = `Макс. ${currentItem.availableQuantity}`; }
                else { quantityToWriteOff = numValue; }
            }
            newSelected.set(instanceId, { ...currentItem, quantityToWriteOff });
            setInputErrors(prevErrors => ({...prevErrors, [instanceId]: error}));
            return newSelected;
        });
    }, []);

     const handleReasonChange = React.useCallback((instanceId: number, value: string) => {
        setSelectedInstances(prevSelected => {
            const currentItem = prevSelected.get(instanceId);
            if (!currentItem) return prevSelected;
            const newSelected = new Map(prevSelected);
            newSelected.set(instanceId, { ...currentItem, reason: value });
            return newSelected;
        });
    }, []);

    const handleFilterCategoryChange = React.useCallback((event: SelectChangeEvent<string>) => {
        setFilterCategory(event.target.value);
        setSelectedInstances(new Map()); setInputErrors({});
    }, []);

    const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    }, []);

    // --- Generate Protocol and Navigate ---
    // Визначення функції тут, ОДИН РАЗ
    const handleGenerateProtocol = React.useCallback(async () => {
        const itemsToProcess = Array.from(selectedInstances.values());
        if (itemsToProcess.length === 0) { setSnackbar({ open: true, message: 'Будь ласка, виберіть хоча б один актив для списання.', severity: 'warning' }); return; }

        // Фінальна валідація
        let formIsValid = true;
        const currentInputErrors = {...inputErrors};
        const finalItemsPayload: GenerateProtocolDto['items'] = [];

        for (const item of itemsToProcess) {
             const qty = Number(item.quantityToWriteOff);
             if (isNaN(qty) || qty < 1 || qty > item.availableQuantity) { formIsValid = false; currentInputErrors[item.instanceId] = `Некоректна к-сть (1-${item.availableQuantity})`; }
             else {
                 delete currentInputErrors[item.instanceId];
                 finalItemsPayload.push({
                    instanceId: item.instanceId,
                    assetTypeId: item.assetTypeId,
                    assetTypeName: item.assetTypeName,
                    unitOfMeasure: item.unitOfMeasure,
                    inventoryNumber: item.inventoryNumber,
                    quantity: qty,
                    reason: item.reason || null,
                    unitCost: item.unitCost,
                 });
             }
             if (!item.assetTypeId || typeof item.assetTypeId !== 'number') { formIsValid = false; console.error(`Missing assetTypeId for instance ${item.instanceId}`); }
        }
        setInputErrors(currentInputErrors);
        if (!formIsValid) { setSnackbar({ open: true, message: 'Будь ласка, виправте помилки у кількості для списання.', severity: 'error' }); return; }
        if (!commissionMembers || commissionMembers.length < 1) { setSnackbar({ open: true, message: 'Не вдалося завантажити дані комісії.', severity: 'warning' }); return; }

        setIsGeneratingProtocol(true); setSnackbar(null);
        const payload: GenerateProtocolDto = { items: finalItemsPayload };
        try {
            const response = await fetch('/api/inventory/generate-protocol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const protocolData: ProtocolDataResponse | ApiErrorData = await response.json();
            if (!response.ok) { throw new Error((protocolData as ApiErrorData).message || `HTTP error! status: ${response.status}`); }

            const confirmationPayload = { items: payload.items.map(p => ({ instanceId: p.instanceId, quantityToWriteOff: p.quantity, reason: p.reason })) };
            sessionStorage.setItem('protocolPreviewData', JSON.stringify(protocolData));
            sessionStorage.setItem('writeOffConfirmationPayload', JSON.stringify(confirmationPayload));
            router.push('/inventory/protocol-preview');
        } catch (err) {
            console.error("Protocol generation error:", err);
            setSnackbar({ open: true, message: `Помилка формування протоколу: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally { setIsGeneratingProtocol(false); }
    // *** ВИПРАВЛЕНО: Видалено залежність assetTypes ***
    }, [selectedInstances, commissionMembers, router, inputErrors]);


    // --- Submit Write-Off (ВИДАЛЕНО ЗВІДСИ) ---


    return (
        <Box>
            <Button component={Link} href="/inventory" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Назад до Інвентарю
            </Button>

            <Typography variant="h4" component="h1" gutterBottom>
                Списання Активів
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Виберіть екземпляри/партії для списання, вкажіть кількість та причину.
            </Typography>

             {/* --- Блок Фільтрів --- */}
            <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                 <Typography variant="h6" sx={{ width: '100%', mb: 1, display: 'flex', alignItems: 'center' }}> <FilterListIcon sx={{ mr: 1 }} /> Фільтри </Typography>
                 <FormControl sx={{ minWidth: 200, flexGrow: 1 }} size="small">
                    <InputLabel id="filter-category-label">Категорія</InputLabel>
                    <Select labelId="filter-category-label" value={filterCategory} label="Категорія" onChange={handleFilterCategoryChange} disabled={!!categoriesError || !categories}>
                        <MenuItem value=""><em>Всі категорії</em></MenuItem>
                        {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка</MenuItem>}
                        {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20}/></MenuItem>}
                        {categories?.map((cat) => ( <MenuItem key={cat.id} value={cat.id.toString()}>{cat.name}</MenuItem> ))}
                    </Select>
                    {categoriesError && <FormHelperText error>Помилка завантаження</FormHelperText>}
                 </FormControl>
                 <TextField label="Пошук (Інв. №, Назва)" variant="outlined" size="small" value={searchTerm} onChange={handleSearchChange} sx={{ minWidth: 250, flexGrow: 1 }} InputProps={{ startAdornment: ( <InputAdornment position="start"><SearchIcon /></InputAdornment> ), }} />
            </Paper>

            {/* Loading/Error States */}
            {isLoadingCandidates && (<Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>)}
            {candidatesError && !isLoadingCandidates && (<Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити активи для списання. {(candidatesError as any).info?.message || candidatesError.message} </Alert>)}

            {/* --- Таблиця Кандидатів на Списання --- */}
            {!isLoadingCandidates && !candidatesError && candidates && (
                <Paper elevation={2} sx={{ mb: 3 }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox"> {/* Checkbox */} </TableCell>
                                    <TableCell>Інв. Номер</TableCell>
                                    <TableCell>Назва Типу</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell>Власник</TableCell>
                                    <TableCell align="right">Доступно (шт.)</TableCell>
                                    <TableCell align="center" sx={{width: '100px'}}>Списати (шт.)</TableCell>
                                    <TableCell>Причина списання</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {candidates.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} align="center">Немає активів, що відповідають фільтрам.</TableCell></TableRow>
                                ) : (
                                    candidates.map((candidate) => (
                                        // Використовуємо мемоізований компонент рядка
                                        <WriteOffRow
                                            key={candidate.instanceId}
                                            candidate={candidate}
                                            // *** ВИПРАВЛЕНО: Передаємо isSelected ***
                                            isSelected={selectedInstances.has(candidate.instanceId)}
                                            selectionData={selectedInstances.get(candidate.instanceId)}
                                            inputError={inputErrors[candidate.instanceId]}
                                            onCheckboxChange={handleCheckboxChange}
                                            onQuantityChange={handleQuantityChange}
                                            onReasonChange={handleReasonChange}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

             {/* --- Секція Комісії та Кнопки "Сформувати Акт" --- */}
             <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 3 }}>
                {/* Список Членів Комісії */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                     <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1}}> <PeopleAltIcon sx={{ mr: 1, color: 'text.secondary' }} /> <Typography variant="h6">Комісія зі Списання</Typography> </Box>
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

                 {/* Кнопка Дій */}
                 <Box sx={{ flex: 1.5, minWidth: 0 }}>
                     <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection:'column', gap: 2, height: '100%' }}>
                        <Typography variant="h6">Дії</Typography>
                        <Button variant="outlined" startIcon={<ArticleIcon />} onClick={handleGenerateProtocol} disabled={selectedInstances.size === 0 || !commissionMembers || isGeneratingProtocol} >
                            {isGeneratingProtocol ? <CircularProgress size={24} /> : 'Сформувати Акт'}
                        </Button>
                         <Typography variant="caption" color="text.secondary">
                            Виберіть активи зі списку вище, вкажіть кількість до списання та причину, а потім натисніть "Сформувати Акт" для перегляду та підтвердження.
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
