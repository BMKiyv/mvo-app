// pages/inventory/write-off.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router';
import { useForm, Controller, SubmitHandler, useFieldArray, FieldErrors } from 'react-hook-form';
import { CommissionRole } from '@prisma/client';

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
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
// Removed unused Card imports, using Paper instead for layout consistency
// import Card from '@mui/material/Card';
// import CardHeader from '@mui/material/CardHeader';
// import CardContent from '@mui/material/CardContent';
import Tooltip from '@mui/material/Tooltip';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ArticleIcon from '@mui/icons-material/Article';
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
type WriteOffFormShape = { items: WriteOffItem[]; };
type ProtocolItemDto = { assetTypeId: number; quantity: number; reason?: string | null; assetTypeName?: string; };
type GenerateProtocolDto = { items: ProtocolItemDto[]; };
type CommissionMemberData = { full_name: string; position: string | null; role: CommissionRole; };
type ProtocolItemData = { assetTypeName: string; quantity: number; reason: string | null; assetTypeId: number; };
type ProtocolDataResponse = { protocolDate: string; commission: { chair: CommissionMemberData | null; members: CommissionMemberData[]; }; items: ProtocolItemData[]; };
type PerformWriteOffResponse = { message: string; createdLogEntries: number; };
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;
type ApiErrorData = { message: string; details?: any };


// --- Компонент Сторінки Списання ---
export default function WriteOffPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();

    // --- State ---
    const [isGeneratingProtocol, setIsGeneratingProtocol] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);

    // --- Data Fetching ---
    const { data: assetTypes, error: assetTypesError } = useSWR<AssetTypeOption[]>('/api/asset-types', fetcher);
    const { data: commissionMembers, error: membersError } = useSWR<CommissionMember[]>('/api/employees/commission-members', fetcher);

    // --- React Hook Form ---
    // Ensure errors is destructured correctly
    const { control, handleSubmit, reset, watch, setValue, trigger, getValues, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<WriteOffFormShape>({ // Use isSubmitting from formState
        defaultValues: { items: [] },
        mode: 'onChange'
    });
    const { fields, append, remove } = useFieldArray({ control, name: "items", keyName: "fieldId" });
    const watchItems = watch("items");


    // --- Handlers ---
    const handleAddItem = () => { append({ assetTypeId: '', assetTypeName: '', quantity: 1, reason: '' }); };
    const handleRemoveItem = (index: number) => { remove(index); };
    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; setSnackbar(null); };

    // --- Helper to Generate Protocol HTML ---
    // Define function ONCE here
    const generateProtocolHtml = (data: ProtocolDataResponse): string => {
        const chair = data.commission.chair;
        const members = data.commission.members;
        const itemsHtml = data.items.map((item, index) => `<tr><td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td><td style="border: 1px solid black; padding: 5px;">${item.assetTypeName || 'N/A'}</td><td style="border: 1px solid black; padding: 5px; text-align: right;">${item.quantity}</td><td style="border: 1px solid black; padding: 5px;">${item.reason || ''}</td></tr>`).join('');
        // Return HTML string
        return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>Акт Списання Матеріальних Цінностей</title><style>@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } } body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; margin: 30px; } table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 12px; } th, td { border: 1px solid black; padding: 4px 6px; vertical-align: top; word-wrap: break-word; } th { background-color: #f2f2f2 !important; text-align: center; font-weight: bold; } .header, .approval { text-align: center; margin-bottom: 20px; } .commission { margin-top: 20px; } .signatures { margin-top: 40px; page-break-inside: avoid; } .signature-row { display: flex; justify-content: space-between; margin-top: 30px; } .signature-item { width: 45%; text-align: left; } .signature-line { margin-top: 10px; border-bottom: 1px solid black; min-width: 150px; display: inline-block; } .signature-label { font-size: 10px; text-align: center; } p { margin: 5px 0; }</style></head><body><div class="approval">ЗАТВЕРДЖУЮ<br/>_________________________<br/>(Посада керівника)<br/>_________ <span class="signature-line"></span><br/>(Підпис) (Ініціали, прізвище)<br/>«___» ____________ 20__ р.</div><div class="header"><h2>АКТ СПИСАННЯ № ____</h2><h3>матеріальних цінностей</h3><p>від ${new Date(data.protocolDate).toLocaleDateString('uk-UA')}</p></div><div class="commission"><p>Комісія, призначена наказом від «___» ____________ 20__ р. № ____ у складі:</p><p>Голова комісії: ${chair ? `${chair.position || '________________'} ${chair.full_name}` : '_____________________________'}</p><p>Члени комісії:</p>${members.map(m => `<p>${m.position || '________________'} ${m.full_name}</p>`).join('')}${members.length === 0 ? '<p>(Члени комісії не вказані)</p>' : ''}<p>провела огляд матеріальних цінностей, що значаться на балансі установи, та встановила, що наступні підлягають списанню:</p></div><table><thead><tr><th>№ п/п</th><th>Найменування цінностей</th><th>Кількість</th><th>Причина списання</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="signatures"><p>Висновок комісії: ________________________________________________________________</p><p>________________________________________________________________________________</p><br/><div class="signature-row"><div class="signature-item">Голова комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (${chair ? chair.full_name.split(' ').slice(-1).join(' ') : '_________'})</span></div><div class="signature-item">Головний бухгалтер _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (ініціали, прізвище)</span></div></div>${members.map(m => `<div class="signature-row"><div class="signature-item">Член комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (${m.full_name.split(' ').slice(-1).join(' ')})</span></div><div class="signature-item"></div></div>`).join('')}</div><div class="print-button-container no-print"><button onclick="window.print()">Друк</button></div></body></html>`;
    };

    // --- Generate Protocol and Navigate ---
    // Define function ONCE here
    const handleGenerateProtocol = async () => {
        console.log("[handleGenerateProtocol] Started.");
        const isValid = await trigger(); // Trigger validation for all fields
        const currentItems = getValues("items");
        console.log(`[handleGenerateProtocol] Form valid: ${isValid}, Items count: ${currentItems?.length}`);

        // Check form validity and if items exist
        if (!isValid || !currentItems || currentItems.length === 0) {
            setSnackbar({ open: true, message: 'Будь ласка, заповніть всі необхідні поля та додайте хоча б один актив.', severity: 'warning' });
            return;
        }
        // Check if commission members are loaded
        if (!commissionMembers || commissionMembers.length < 1) {
             setSnackbar({ open: true, message: 'Не вдалося завантажити дані комісії або комісія не призначена.', severity: 'warning' });
            return;
        }

        setIsGeneratingProtocol(true);
        setSnackbar(null);

        const payload: GenerateProtocolDto = {
            items: currentItems.map(item => ({
                assetTypeId: Number(item.assetTypeId),
                quantity: Number(item.quantity),
                reason: item.reason || null,
                assetTypeName: assetTypes?.find(t => t.id === Number(item.assetTypeId))?.name || `ID: ${item.assetTypeId}`
            }))
        };
        console.log("[handleGenerateProtocol] Payload for API:", payload);

        try {
            const response = await fetch('/api/inventory/generate-protocol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            console.log("[handleGenerateProtocol] API response status:", response.status);
            const protocolData: ProtocolDataResponse | ApiErrorData = await response.json();

            if (!response.ok) {
                 console.error("[handleGenerateProtocol] API Error:", protocolData);
                 throw new Error((protocolData as ApiErrorData).message || `HTTP error! status: ${response.status}`);
            }
            console.log("[handleGenerateProtocol] Received protocol data:", protocolData);

            // Save to sessionStorage and navigate
            try {
                sessionStorage.setItem('protocolPreviewData', JSON.stringify(protocolData));
                console.log("[handleGenerateProtocol] Data saved to sessionStorage. Attempting navigation...");
                // Use router.push without await, handle result in .then/.catch
                router.push('/inventory/protocol-preview')
                    .then(success => {
                        console.log("[handleGenerateProtocol] router.push completed. Success:", success);
                        if (!success) {
                             console.warn("[handleGenerateProtocol] Navigation returned false.");
                             setSnackbar({ open: true, message: 'Не вдалося виконати перехід на сторінку перегляду.', severity: 'error' });
                        }
                    })
                    .catch(navError => {
                        console.error("[handleGenerateProtocol] Error during router.push:", navError);
                        setSnackbar({ open: true, message: `Помилка навігації: ${navError.message}`, severity: 'error' });
                    });
                 console.log("[handleGenerateProtocol] router.push call initiated.");
            } catch (storageError) {
                 console.error("[handleGenerateProtocol] Session storage error:", storageError);
                 setSnackbar({ open: true, message: 'Помилка збереження даних для перегляду протоколу.', severity: 'error' });
            }

        } catch (err) {
            console.error("[handleGenerateProtocol] Fetch/processing error:", err);
            setSnackbar({ open: true, message: `Помилка формування протоколу: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
             setIsGeneratingProtocol(false);
             console.log("[handleGenerateProtocol] Finished.");
        }
    };

    // --- Submit Write-Off (ВИДАЛЕНО) ---


    return (
        <Box>
            <Button component={Link} href="/inventory" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Назад до Інвентарю
            </Button>

            <Typography variant="h4" component="h1" gutterBottom>
                Списання Активів
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Додайте активи для списання, вкажіть кількість та причину (необов'язково).
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
                                <TableCell sx={{width: '40%', pl:0}}>Тип Активу</TableCell>
                                <TableCell sx={{width: '15%'}} align="right">Кількість</TableCell>
                                <TableCell>Причина списання</TableCell>
                                <TableCell align="right" sx={{width: '50px', pr:0}}>Дія</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.fieldId}>
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5, pl:0}}>
                                        <Controller
                                            name={`items.${index}.assetTypeId`} control={control} defaultValue="" rules={{ required: 'Виберіть тип' }}
                                            render={({ field: selectField, fieldState }) => (
                                                <FormControl fullWidth error={!!fieldState.error || !!assetTypesError} size="small" disabled={!assetTypes}>
                                                    <Select {...selectField} displayEmpty
                                                        onChange={(e) => {
                                                            const selectedId = Number(e.target.value);
                                                            const selectedType = assetTypes?.find(t => t.id === selectedId);
                                                            setValue(`items.${index}.assetTypeName`, selectedType?.name || '');
                                                            selectField.onChange(selectedId);
                                                        }}
                                                        value={selectField.value || ''} >
                                                        <MenuItem value="" disabled>-- Тип --</MenuItem>
                                                        {assetTypesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка</MenuItem>}
                                                        {assetTypes?.map((type) => ( <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem> ))}
                                                    </Select>
                                                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                                                </FormControl>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5}} align="right">
                                         <Controller
                                            name={`items.${index}.quantity`} control={control} defaultValue={1} rules={{ required: 'Введіть к-сть', min: { value: 1, message: 'Мін. 1' } }}
                                            render={({ field: qtyField, fieldState }) => ( <TextField {...qtyField} type="number" size="small" error={!!fieldState.error} helperText={fieldState.error?.message} InputProps={{ inputProps: { min: 1 } }} sx={{width: '80px'}} /> )}
                                        />
                                    </TableCell>
                                    <TableCell sx={{verticalAlign: 'top', pt: 1.5}}>
                                        <Controller name={`items.${index}.reason`} control={control} defaultValue="" render={({ field: reasonField }) => ( <TextField {...reasonField} size="small" fullWidth placeholder="Причина..."/> )} />
                                    </TableCell>
                                    <TableCell align="right" sx={{verticalAlign: 'top', pt: 1, pr:0}}>
                                        <IconButton onClick={() => handleRemoveItem(index)} color="error" size="small" aria-label="Видалити рядок"> <DeleteIcon /> </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {fields.length === 0 && ( <TableRow><TableCell colSpan={4} align="center"><Typography variant="caption" color="textSecondary">Додайте активи для списання.</Typography></TableCell></TableRow> )}
                        </TableBody>
                    </Table>
                </TableContainer>
                 {/* *** ВИПРАВЛЕНО: Перевірка помилок форми *** */}
                 {errors.items && ( // Check if there are errors within the items array
                     <Alert severity="error" sx={{ mt: 2 }}>Будь ласка, виправте помилки в рядках списання.</Alert>
                 )}
            </Paper>

             {/* --- Секція Комісії та Кнопки Дій (Flexbox) --- */}
             <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 3 }}>
                {/* Список Членів Комісії */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
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
                 <Box sx={{ flex: 1.5, minWidth: 0 }}>
                     <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection:'column', gap: 2, height: '100%' }}>
                        <Typography variant="h6">Дії</Typography>
                        <Button variant="outlined" startIcon={<ArticleIcon />} onClick={handleGenerateProtocol} disabled={!watchItems || watchItems.length === 0 || !commissionMembers || isGeneratingProtocol} >
                            {isGeneratingProtocol ? <CircularProgress size={24} /> : 'Сформувати Акт'}
                        </Button>
                         {/* --- Кнопка Підтвердження Списання Видалена --- */}
                         <Typography variant="caption" color="text.secondary">
                            Натисніть "Сформувати Акт", щоб переглянути та роздрукувати документ. Підтвердження списання відбувається на сторінці перегляду акту.
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
