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
// *** ДОДАНО ІМПОРТИ ТАБЛИЦІ ***
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
// *** КІНЕЦЬ ІМПОРТІВ ТАБЛИЦІ ***
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
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Tooltip from '@mui/material/Tooltip';


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
type WriteOffFormShape = { items: WriteOffItem[]; };
type ProtocolItemDto = { assetTypeId: number; quantity: number; reason?: string | null; assetTypeName?: string; };
type GenerateProtocolDto = { items: ProtocolItemDto[]; };
type CommissionMemberData = { full_name: string; position: string | null; role: CommissionRole; };
type ProtocolItemData = { assetTypeName: string; quantity: number; reason: string | null; };
type ProtocolDataResponse = { protocolDate: string; commission: { chair: CommissionMemberData | null; members: CommissionMemberData[]; }; items: ProtocolItemData[]; };
type PerformWriteOffResponse = { message: string; createdLogEntries: number; };
// *** ВИПРАВЛЕНО ТИП SNACKBAR ***
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;
type ApiErrorData = { message: string; details?: any };


// --- Компонент Сторінки Списання ---
export default function WriteOffPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();

    // --- State ---
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isGeneratingProtocol, setIsGeneratingProtocol] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null); // Використовуємо виправлений тип

    // --- Data Fetching ---
    const { data: assetTypes, error: assetTypesError } = useSWR<AssetTypeOption[]>('/api/asset-types', fetcher);
    const { data: commissionMembers, error: membersError } = useSWR<CommissionMember[]>('/api/employees/commission-members', fetcher);

    // --- React Hook Form ---
    // Переконуємося, що errors деструктуровано правильно
    const { control, handleSubmit, reset, watch, setValue, trigger, getValues, formState: { errors } } = useForm<WriteOffFormShape>({
        defaultValues: { items: [] },
        mode: 'onChange'
    });
    const { fields, append, remove } = useFieldArray({ control, name: "items", keyName: "fieldId" });
    const watchItems = watch("items");


    // --- Handlers ---
    const handleAddItem = () => { append({ assetTypeId: '', assetTypeName: '', quantity: 1, reason: '' }); };
    const handleRemoveItem = (index: number) => { remove(index); };
    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; setSnackbar(null); };

    // --- Generate Protocol ---
    const handleGenerateProtocol = async () => {
        const isValid = await trigger();
        const currentItems = getValues("items");

        if (!isValid || !currentItems || currentItems.length === 0) {
            setSnackbar({ open: true, message: 'Будь ласка, заповніть всі необхідні поля та додайте хоча б один актив.', severity: 'warning' });
            return;
        }
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
        try {
            const response = await fetch('/api/inventory/generate-protocol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const protocolData: ProtocolDataResponse | ApiErrorData = await response.json();
            if (!response.ok) { throw new Error((protocolData as ApiErrorData).message || `HTTP error! status: ${response.status}`); }
            const protocolHtml = generateProtocolHtml(protocolData as ProtocolDataResponse);
            const printWindow = window.open('', '_blank', 'height=800,width=800,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(protocolHtml);
                printWindow.document.close();
                setTimeout(() => { try { printWindow.print(); } catch (printError) { console.error("Print error:", printError); setSnackbar({ open: true, message: 'Помилка виклику друку. Спробуйте вручну (Ctrl+P).', severity: 'warning' }); } }, 500);
                 setSnackbar({ open: true, message: 'Протокол сформовано. Відкривається вікно друку.', severity: 'success' });
            } else { setSnackbar({ open: true, message: 'Не вдалося відкрити вікно для друку. Перевірте блокування спливаючих вікон.', severity: 'warning' }); }
        } catch (err) {
            console.error("Protocol generation error:", err);
            setSnackbar({ open: true, message: `Помилка формування протоколу: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally { setIsGeneratingProtocol(false); }
    };

    // --- Submit Write-Off ---
    const onSubmit: SubmitHandler<WriteOffFormShape> = async (data) => {
        if (!data.items || data.items.length === 0) { setSnackbar({ open: true, message: 'Список списання порожній.', severity: 'warning' }); return; }
        const confirmed = confirm(`Ви впевнені, що хочете підтвердити списання ${data.items.length} позицій? Це оновить залишки.`);
        if (!confirmed) return;
        setIsSubmitting(true);
        setSnackbar(null);
        const payload = { items: data.items.map(item => ({ assetTypeId: Number(item.assetTypeId), quantity: Number(item.quantity), reason: item.reason || null, })), };
        try {
            const response = await fetch('/api/inventory/perform-write-off', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), });
            const result: PerformWriteOffResponse | ApiErrorData = await response.json();
            if (!response.ok) { throw new Error((result as ApiErrorData).message || `HTTP error! status: ${response.status}`); }
            setSnackbar({ open: true, message: (result as PerformWriteOffResponse).message || 'Списання успішно зафіксовано!', severity: 'success' });
            reset({ items: [] });
            mutate('/api/dashboard/summary');
            mutate('/api/asset-types');
        } catch (err) {
            console.error("Write-off submission error:", err);
            setSnackbar({ open: true, message: `Помилка списання: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally { setIsSubmitting(false); }
    };

    // --- Helper to Generate Protocol HTML ---
    const generateProtocolHtml = (data: ProtocolDataResponse): string => {
        const chair = data.commission.chair;
        const members = data.commission.members;
        const itemsHtml = data.items.map((item, index) => `<tr><td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td><td style="border: 1px solid black; padding: 5px;">${item.assetTypeName || 'N/A'}</td><td style="border: 1px solid black; padding: 5px; text-align: right;">${item.quantity}</td><td style="border: 1px solid black; padding: 5px;">${item.reason || ''}</td></tr>`).join('');
        return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>Акт Списання Матеріальних Цінностей</title><style>@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } } body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; margin: 30px; } table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 12px; } th, td { border: 1px solid black; padding: 4px 6px; vertical-align: top; } th { background-color: #f2f2f2; text-align: center; font-weight: bold; } .header, .approval { text-align: center; margin-bottom: 20px; } .commission { margin-top: 20px; } .signatures { margin-top: 40px; page-break-inside: avoid; } .signature-row { display: flex; justify-content: space-between; margin-top: 30px; } .signature-item { width: 45%; text-align: left; } .signature-line { margin-top: 10px; border-bottom: 1px solid black; min-width: 150px; display: inline-block; } .signature-label { font-size: 10px; text-align: center; } p { margin: 5px 0; }</style></head><body><div class="approval">ЗАТВЕРДЖУЮ<br/>_________________________<br/>(Посада керівника)<br/>_________ <span class="signature-line"></span><br/>(Підпис) (Ініціали, прізвище)<br/>«___» ____________ 20__ р.</div><div class="header"><h2>АКТ СПИСАННЯ</h2><h3>матеріальних цінностей</h3><p>від ${new Date(data.protocolDate).toLocaleDateString('uk-UA')}</p></div><div class="commission"><p>Комісія, призначена наказом від «___» ____________ 20__ р. № ____ у складі:</p><p>Голова комісії: ${chair ? `${chair.position || '________________'} ${chair.full_name}` : '_____________________________'}</p><p>Члени комісії:</p>${members.map(m => `<p>${m.position || '________________'} ${m.full_name}</p>`).join('')}${members.length === 0 ? '<p>(Члени комісії не вказані)</p>' : ''}<p>провела огляд матеріальних цінностей, що значаться на балансі установи, та встановила, що наступні підлягають списанню:</p></div><table><thead><tr><th>№ п/п</th><th>Найменування цінностей</th><th>Кількість</th><th>Причина списання</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="signatures"><p>Висновок комісії: ________________________________________________________________</p><p>________________________________________________________________________________</p><br/><div class="signature-row"><div class="signature-item">Голова комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (ініціали, прізвище)</span></div><div class="signature-item">Головний бухгалтер _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (ініціали, прізвище)</span></div></div>${members.map(m => `<div class="signature-row"><div class="signature-item">Член комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (ініціали, прізвище)</span></div><div class="signature-item"></div></div>`).join('')}</div><button class="no-print" onclick="window.print()">Друк</button></body></html>`;
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
                Додайте активи для списання, вкажіть кількість та причину (необов'язково).
            </Typography>

            {/* --- Форма Додавання Рядків --- */}
            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Додати позицію до списання</Typography>
                <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleAddItem} sx={{ mb: 2 }} >
                    Додати Рядок
                </Button>
                {/* *** ВИПРАВЛЕНО: Додано TableContainer *** */}
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
                 {Object.keys(errors).length > 0 && (
                     <Alert severity="error" sx={{ mt: 2 }}>Будь ласка, виправте помилки у формі.</Alert>
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
                        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleGenerateProtocol} disabled={!watchItems || watchItems.length === 0 || !commissionMembers || isSubmitting || isGeneratingProtocol} >
                            {isGeneratingProtocol ? <CircularProgress size={24} /> : 'Сформувати Протокол'}
                        </Button>
                         <Button variant="contained" color="error" startIcon={<CheckCircleOutlineIcon />} onClick={handleSubmit(onSubmit)} disabled={!watchItems || watchItems.length === 0 || isSubmitting || isGeneratingProtocol} >
                             {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Підтвердити Списання'}
                         </Button>
                         <Typography variant="caption" color="text.secondary">
                            Увага: Після підтвердження списання буде зафіксовано в системі. Перевірте дані перед підтвердженням.
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
