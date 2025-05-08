// pages/inventory/write-off.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router'; // Corrected: next/router for Pages Router
import { CommissionRole, AssetStatus, Employee } from '@prisma/client';

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
// import IconButton from '@mui/material/IconButton'; // Not used
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
// import List from '@mui/material/List'; // Not used directly, but by Select
// import ListItem from '@mui/material/ListItem'; // Not used directly
import ListItemText from '@mui/material/ListItemText'; // For Select multiple
// import Tooltip from '@mui/material/Tooltip'; // Not used
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
// import PeopleAltIcon from '@mui/icons-material/PeopleAlt'; // Not used
import ArticleIcon from '@mui/icons-material/Article';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
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
type FullEmployeeData = Employee; // Assuming Employee from Prisma includes all necessary fields

type WriteOffCandidate = {
    instanceId: number; inventoryNumber: string; assetTypeName: string;
    assetTypeId: number; unitOfMeasure: string; status: AssetStatus;
    employeeFullName: string | null; quantity: number; purchase_date: string;
    unit_cost: string; // Keep as string, as it comes from API like this
    notes?: string | null; categoryName: string | null;
};

type SelectedWriteOffItem = {
    instanceId: number; assetTypeId: number; assetTypeName: string;
    unitOfMeasure: string; quantityToWriteOff: number | string;
    itemSpecificReason: string;
    inventoryNumber: string; unitCost: string; // unitCost is a string
    availableQuantity: number;
};

// DTO for the API endpoint /api/inventory/perform-write-off
interface AffectedAssetInstanceItemDto {
    instanceId: number;
    quantityToWriteOff: number;
    itemSpecificReason?: string | null;
}

// Main DTO for the API endpoint
interface BatchInstanceWriteOffDto {
    writeOffDate?: string;
    mainReason?: string | null;
    mainNotes?: string | null;
    writeOffDocumentNumber?: string | null;
    commissionChairId?: number | null;
    headOfEnterpriseSignatoryId?: number | null;
    chiefAccountantSignatoryId?: number | null;
    commissionMemberIds?: number[];
    items: AffectedAssetInstanceItemDto[];
}

// --- NEW: Types for data stored in sessionStorage for protocol-preview.tsx ---
interface PreviewWriteOffItem {
    instanceId: number;
    quantityToWriteOff: number;
    itemSpecificReason?: string | null;
    // --- Enriched fields for display ---
    inventoryNumber: string;
    assetTypeName: string;
    unitOfMeasure: string;
    unitCost: string; // This is the string representation of cost, e.g., "123.45"
    // Add any other fields from SelectedWriteOffItem if needed by protocol-preview.tsx:
    // e.g., assetTypeId?: number;
    // e.g., purchase_date?: string;
}

interface PendingWriteOffActPreviewData {
    writeOffDate?: string;
    mainReason?: string | null;
    mainNotes?: string | null;
    writeOffDocumentNumber?: string | null;
    commissionChairId?: number | null;
    headOfEnterpriseSignatoryId?: number | null;
    chiefAccountantSignatoryId?: number | null;
    commissionMemberIds?: number[];
    items: PreviewWriteOffItem[];
    // Consider adding names of signatories here if you want to avoid fetching them on protocol-preview
    // commissionChairName?: string;
    // headOfEnterpriseSignatoryName?: string;
    // chiefAccountantSignatoryName?: string;
    // commissionMemberNames?: {id: number, name: string}[];
}
// --- END NEW TYPES ---

type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;
// type ApiErrorData = { message: string; details?: any }; // Already declared in API, not needed on client unless for specific error handling

interface WriteOffRowProps {
    candidate: WriteOffCandidate;
    isSelected: boolean;
    selectionData: SelectedWriteOffItem | undefined;
    inputError: string | undefined;
    onCheckboxChange: (event: React.ChangeEvent<HTMLInputElement>, candidate: WriteOffCandidate) => void;
    onQuantityChange: (instanceId: number, value: string) => void;
    onReasonChange: (instanceId: number, value: string) => void;
}

const WriteOffRow: React.FC<WriteOffRowProps> = React.memo(({ candidate, isSelected, selectionData, inputError, onCheckboxChange, onQuantityChange, onReasonChange }) => {
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
            <TableCell> <TextField size="small" fullWidth placeholder="Особлива причина (якщо є)..." value={isSelected ? selectionData?.itemSpecificReason ?? '' : ''} onChange={(e) => onReasonChange(candidate.instanceId, e.target.value)} disabled={!isSelected} /> </TableCell>
        </TableRow>
    );
});
WriteOffRow.displayName = 'WriteOffRow';

export default function WriteOffPage() {
    const router = useRouter();
    // const { mutate } = useSWRConfig(); // `mutate` from useSWRConfig is not used in the provided code

    // --- State ---
    const [selectedInstances, setSelectedInstances] = React.useState<Map<number, SelectedWriteOffItem>>(new Map());
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);
    const [inputErrors, setInputErrors] = React.useState<{[key: number]: string | undefined}>({});
    const [filterCategory, setFilterCategory] = React.useState<string>('');
    const [searchTerm, setSearchTerm] = React.useState<string>('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState<string>('');

    // --- Стани для деталей Акту ---
    const [actDate, setActDate] = React.useState<Date | null>(new Date());
    const [mainReason, setMainReason] = React.useState<string>('');
    const [mainNotes, setMainNotes] = React.useState<string>('');
    const [documentNumber, setDocumentNumber] = React.useState<string>('');
    const [commissionChairId, setCommissionChairId] = React.useState<string>('');
    const [headOfEnterpriseId, setHeadOfEnterpriseId] = React.useState<string>('');
    const [chiefAccountantId, setChiefAccountantId] = React.useState<string>('');
    const [selectedCommissionMemberIds, setSelectedCommissionMemberIds] = React.useState<number[]>([]);

    // --- Debounce Search Term ---
    React.useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 500);
        return () => { clearTimeout(handler); };
    }, [searchTerm]);

    // --- Data Fetching ---
    const { data: categories, error: categoriesError } = useSWR<AssetCategoryOption[]>('/api/asset-categories', fetcher);
    const { data: allEmployees, error: employeesError } = useSWR<FullEmployeeData[]>('/api/employees', fetcher);

    const candidatesUrl = React.useMemo(() => {
        const params = new URLSearchParams();
        if (filterCategory) params.append('categoryId', filterCategory);
        if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
        return `/api/asset-instances/write-off-candidates?${params.toString()}`;
    }, [filterCategory, debouncedSearchTerm]);
    const { data: candidates, error: candidatesError, isLoading: isLoadingCandidates } = useSWR<WriteOffCandidate[]>(
        candidatesUrl, fetcher, { revalidateOnFocus: false }
    );

    // --- Фільтрація співробітників для селекторів ---
    const potentialChairs = React.useMemo(() => allEmployees?.filter(e => e.is_active && e.commission_role === CommissionRole.chair) || [], [allEmployees]);
    const potentialHeads = React.useMemo(() => allEmployees?.filter(e => e.is_active && e.is_head_of_enterprise) || [], [allEmployees]);
    const potentialAccountants = React.useMemo(() => allEmployees?.filter(e => e.is_active && e.is_chief_accountant) || [], [allEmployees]);
    const potentialCommissionMembers = React.useMemo(() => {
        const chairIdNum = commissionChairId ? parseInt(commissionChairId) : null;
        return allEmployees?.filter(e => e.is_active && e.commission_role === CommissionRole.member && (chairIdNum ? e.id !== chairIdNum : true)) || [];
    }, [allEmployees, commissionChairId]);


    // --- Handlers ---
    const handleCloseSnackbar = React.useCallback((event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; setSnackbar(null); }, []);

    const handleCheckboxChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>, candidate: WriteOffCandidate) => {
        const instanceId = candidate.instanceId;
        setSelectedInstances(prevSelected => {
            const newSelected = new Map(prevSelected);
            if (event.target.checked) {
                newSelected.set(instanceId, {
                    instanceId: instanceId, assetTypeId: candidate.assetTypeId, assetTypeName: candidate.assetTypeName,
                    unitOfMeasure: candidate.unitOfMeasure, quantityToWriteOff: 1, itemSpecificReason: '',
                    inventoryNumber: candidate.inventoryNumber, unitCost: candidate.unit_cost, // unit_cost is string from candidate
                    availableQuantity: candidate.quantity,
                });
            } else { newSelected.delete(instanceId); }
            return newSelected;
        });
        setInputErrors(prev => { const newErrors = {...prev}; delete newErrors[instanceId]; return newErrors; });
    }, []);

    const handleQuantityChange = React.useCallback((instanceId: number, value: string) => {
        setSelectedInstances(prevSelected => {
            const currentItem = prevSelected.get(instanceId);
            if (!currentItem) return prevSelected;
            const newSelected = new Map(prevSelected);
            let quantityToWriteOff: number | string = 1;
            let error: string | undefined = undefined;
            if (value.trim() === '') { quantityToWriteOff = ''; error = 'К-сть обов\'язкова'; }
            else {
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
            newSelected.set(instanceId, { ...currentItem, itemSpecificReason: value });
            return newSelected;
        });
    }, []);

    const handleFilterCategoryChange = React.useCallback((event: SelectChangeEvent<string>) => { setFilterCategory(event.target.value); setSelectedInstances(new Map()); setInputErrors({}); }, []);
    const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(event.target.value); }, []);

    const handleProceedToPreview = React.useCallback(async () => {
        const itemsToProcessFromState = Array.from(selectedInstances.values());
        if (itemsToProcessFromState.length === 0) {
            setSnackbar({ open: true, message: 'Будь ласка, виберіть хоча б один актив для списання.', severity: 'warning' });
            return;
        }

        let formIsValid = true;
        const currentInputErrorsUpdate = {...inputErrors};
        // const finalAffectedItems: AffectedAssetInstanceItemDto[] = []; // This was for the old DTO

        // UPDATED: Prepare items for preview with richer data
        const previewItems: PreviewWriteOffItem[] = [];

        for (const item of itemsToProcessFromState) {
            const qty = Number(item.quantityToWriteOff);
            if (isNaN(qty) || qty < 1 || qty > item.availableQuantity) {
                formIsValid = false;
                currentInputErrorsUpdate[item.instanceId] = `Некоректна к-сть (1-${item.availableQuantity})`;
            } else {
                delete currentInputErrorsUpdate[item.instanceId];
                previewItems.push({
                    instanceId: item.instanceId,
                    quantityToWriteOff: qty,
                    itemSpecificReason: item.itemSpecificReason || null,
                    // --- Add enriched fields for preview ---
                    inventoryNumber: item.inventoryNumber,
                    assetTypeName: item.assetTypeName,
                    unitOfMeasure: item.unitOfMeasure,
                    unitCost: item.unitCost, // unitCost is a string like "123.45"
                });
            }
        }
        setInputErrors(currentInputErrorsUpdate);

        if (!formIsValid) {
            setSnackbar({ open: true, message: 'Будь ласка, виправте помилки у кількості для списання.', severity: 'error' });
            return;
        }

        if (!commissionChairId) {
            setSnackbar({ open: true, message: 'Будь ласка, оберіть голову комісії.', severity: 'warning' });
            return;
        }
        // Optional: Add validation for headOfEnterpriseId and chiefAccountantId if they become mandatory
        // if (!headOfEnterpriseId) { ... }
        // if (!chiefAccountantId) { ... }

        setIsProcessing(true);
        setSnackbar(null);

        // UPDATED: Use PendingWriteOffActPreviewData for sessionStorage
        const writeOffActDataForPreview: PendingWriteOffActPreviewData = {
            writeOffDate: actDate ? actDate.toISOString().split('T')[0] : undefined,
            mainReason: mainReason || null,
            mainNotes: mainNotes || null,
            writeOffDocumentNumber: documentNumber || null,
            commissionChairId: commissionChairId ? parseInt(commissionChairId) : null,
            headOfEnterpriseSignatoryId: headOfEnterpriseId ? parseInt(headOfEnterpriseId) : null,
            chiefAccountantSignatoryId: chiefAccountantId ? parseInt(chiefAccountantId) : null,
            commissionMemberIds: selectedCommissionMemberIds.filter(id => id !== (commissionChairId ? parseInt(commissionChairId) : null) ),
            items: previewItems, // Use the enriched items
        };

        try {
            sessionStorage.setItem('pendingWriteOffActData', JSON.stringify(writeOffActDataForPreview));
            router.push('/inventory/protocol-preview');
        } catch (err) {
            console.error("Error preparing for protocol preview:", err);
            setSnackbar({ open: true, message: `Помилка підготовки до перегляду: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
            setIsProcessing(false);
        }
    }, [
        selectedInstances, inputErrors,
        actDate, mainReason, mainNotes, documentNumber,
        commissionChairId, headOfEnterpriseId, chiefAccountantId, selectedCommissionMemberIds,
        router
    ]);
    // {{console.log(allEmployees)}} // This console.log will cause hydration errors if left in production
    
    return (
        <Box sx={{pb: 4}}>
            <Button component={Link} href="/inventory" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Назад до Інвентарю
            </Button>

            <Typography variant="h4" component="h1" gutterBottom>
                Списання Активів
            </Typography>

            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Деталі Акту Списання</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 180px', minWidth: '180px' }}>
                            <TextField
                                label="Дата Акту"
                                type="date"
                                value={actDate ? actDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => setActDate(e.target.value ? new Date(e.target.value) : null)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                size="small"
                            />
                        </Box>
                        <Box sx={{ flex: '1 1 180px', minWidth: '180px' }}>
                            <TextField
                                label="Номер Документа (якщо є)"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                fullWidth
                                size="small"
                            />
                        </Box>
                        <Box sx={{ flex: '2 1 300px', minWidth: '200px' }}>
                            <TextField
                                label="Загальна Причина Списання (для акту)"
                                value={mainReason}
                                onChange={(e) => setMainReason(e.target.value)}
                                fullWidth
                                size="small"
                            />
                        </Box>
                    </Box>

                    <Box sx={{ width: '100%' }}>
                        <TextField
                            label="Загальні Нотатки (для акту)"
                            value={mainNotes}
                            onChange={(e) => setMainNotes(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                        />
                    </Box>

                    <Divider sx={{my:1}}>Підписанти та Комісія</Divider>

                    {/* Рядок 3: Підписанти (Голова комісії, Керівник, Головбух) */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, flexWrap: 'wrap' }}>
                        {/* Голова Комісії */}
                        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                            <FormControl fullWidth size="small" error={!!employeesError && !allEmployees} required>
                                <InputLabel id="chair-label">Голова Комісії*</InputLabel>
                                <Select
                                    labelId="chair-label"
                                    value={commissionChairId}
                                    label="Голова Комісії*"
                                    onChange={(e) => setCommissionChairId(e.target.value)}
                                    disabled={!allEmployees || !!employeesError}
                                >
                                    <MenuItem value=""><em>Не обрано</em></MenuItem>
                                    {potentialChairs.map(emp => <MenuItem key={emp.id} value={emp.id.toString()}>{emp.full_name}</MenuItem>)}
                                </Select>
                                {employeesError && <FormHelperText error>Помилка завантаження співробітників</FormHelperText>}
                                {!employeesError && allEmployees && potentialChairs.length === 0 && <FormHelperText>Не знайдено співробітників з роллю "Голова комісії"</FormHelperText>}
                            </FormControl>
                        </Box>

                        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                            <FormControl fullWidth size="small" error={!!employeesError && !allEmployees}>
                                <InputLabel id="head-enterprise-label">Керівник Підприємства</InputLabel>
                                <Select
                                    labelId="head-enterprise-label"
                                    value={headOfEnterpriseId}
                                    label="Керівник Підприємства"
                                    onChange={(e) => setHeadOfEnterpriseId(e.target.value)}
                                    disabled={!allEmployees || !!employeesError}
                                >
                                    <MenuItem value=""><em>Не обрано</em></MenuItem>
                                    {potentialHeads.map(emp => <MenuItem key={emp.id} value={emp.id.toString()}>{emp.full_name}</MenuItem>)}
                                </Select>
                                {employeesError && <FormHelperText error>Помилка завантаження співробітників</FormHelperText>}
                                {!employeesError && allEmployees && potentialHeads.length === 0 && <FormHelperText>Керівників підприємства не знайдено</FormHelperText>}
                            </FormControl>
                        </Box>

                        <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                            <FormControl fullWidth size="small" error={!!employeesError && !allEmployees}>
                                <InputLabel id="chief-accountant-label">Головний Бухгалтер</InputLabel>
                                <Select
                                    labelId="chief-accountant-label"
                                    value={chiefAccountantId}
                                    label="Головний Бухгалтер"
                                    onChange={(e) => setChiefAccountantId(e.target.value)}
                                    disabled={!allEmployees || !!employeesError}
                                >
                                    <MenuItem value=""><em>Не обрано</em></MenuItem>
                                    {potentialAccountants.map(emp => <MenuItem key={emp.id} value={emp.id.toString()}>{emp.full_name}</MenuItem>)}
                                </Select>
                                {employeesError && <FormHelperText error>Помилка завантаження співробітників</FormHelperText>}
                                {!employeesError && allEmployees && potentialAccountants.length === 0 && <FormHelperText>Головних бухгалтерів не знайдено</FormHelperText>}
                            </FormControl>
                        </Box>
                    </Box>

                    {/* Рядок 4: Інші Члени Комісії */}
                    <Box sx={{ width: '100%' }}>
                        <FormControl fullWidth size="small" error={!!employeesError && !allEmployees}>
                            <InputLabel id="commission-members-label">Інші Члени Комісії</InputLabel>
                            <Select
                                labelId="commission-members-label"
                                multiple
                                value={selectedCommissionMemberIds.map(String)} // Select multiple очікує масив рядків
                                onChange={(e) => {
                                    const value = e.target.value as string[];
                                    setSelectedCommissionMemberIds(value.map(Number)); // Конвертуємо рядки ID назад в числа
                                }}
                                label="Інші Члени Комісії"
                                renderValue={(selected) => { // selected тут буде масивом рядкових ID
                                    const selectedNames = (selected as string[])
                                        .map(idStr => allEmployees?.find(e => e.id === parseInt(idStr))?.full_name)
                                        .filter(name => !!name);
                                    return selectedNames.join(', ');
                                }}
                                disabled={!allEmployees || !!employeesError}
                            >
                                {potentialCommissionMembers.map(emp => (
                                    <MenuItem key={emp.id} value={emp.id.toString()}>
                                        <Checkbox checked={selectedCommissionMemberIds.includes(emp.id)} />
                                        <ListItemText primary={emp.full_name} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {employeesError && <FormHelperText error>Помилка завантаження співробітників</FormHelperText>}
                            {!employeesError && allEmployees && potentialCommissionMembers.length === 0 && <FormHelperText>Не знайдено співробітників з роллю "Член комісії" (окрім голови)</FormHelperText>}
                        </FormControl>
                    </Box>
                </Box>
            </Paper>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Виберіть екземпляри/партії для списання, вкажіть кількість та індивідуальну причину (якщо відрізняється від загальної).
            </Typography>

            <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ width: '100%', mb: 1, display: 'flex', alignItems: 'center' }}> <FilterListIcon sx={{ mr: 1 }} /> Фільтри </Typography>
                <FormControl sx={{ minWidth: 200, flexGrow: 1 }} size="small">
                    <InputLabel id="filter-category-label">Категорія</InputLabel>
                    <Select labelId="filter-category-label" value={filterCategory} label="Категорія" onChange={handleFilterCategoryChange} disabled={!!categoriesError || !categories}>
                        <MenuItem value=""><em>Всі категорії</em></MenuItem>
                        {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка завантаження категорій</MenuItem>}
                        {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20}/></MenuItem>}
                        {categories?.map((cat) => ( <MenuItem key={cat.id} value={cat.id.toString()}>{cat.name}</MenuItem> ))}
                    </Select>
                    {categoriesError && <FormHelperText error>Помилка завантаження категорій</FormHelperText>}
                </FormControl>
                <TextField label="Пошук (Інв. №, Назва)" variant="outlined" size="small" value={searchTerm} onChange={handleSearchChange} sx={{ minWidth: 250, flexGrow: 1 }} InputProps={{ startAdornment: ( <InputAdornment position="start"><SearchIcon /></InputAdornment> ), }} />
            </Paper>

            {isLoadingCandidates && (<Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>)}
            {candidatesError && !isLoadingCandidates && (<Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити активи для списання. {((candidatesError as any).info?.message || (candidatesError as Error).message)} </Alert>)}

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
                                    <TableCell>Особлива Причина</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {candidates.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} align="center">Немає активів, що відповідають фільтрам.</TableCell></TableRow>
                                ) : (
                                    candidates.map((candidate) => (
                                        <WriteOffRow
                                            key={candidate.instanceId}
                                            candidate={candidate}
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<ArticleIcon />}
                    onClick={handleProceedToPreview}
                    disabled={
                        selectedInstances.size === 0 ||
                        !allEmployees || // Якщо співробітники не завантажені
                        isProcessing ||
                        !commissionChairId // Голова комісії обов'язковий
                        // Додайте сюди !headOfEnterpriseId || !chiefAccountantId, якщо вони стануть обов'язковими
                    }
                >
                    {isProcessing ? <CircularProgress size={24} /> : 'Сформувати Акт для Перегляду'}
                </Button>
            </Box>

            {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>
            )}
        </Box>
    );
}