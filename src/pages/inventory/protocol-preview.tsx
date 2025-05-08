// pages/inventory/protocol-preview.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import { CommissionRole, Employee } from '@prisma/client';
import useSWR, { mutate } from 'swr';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';

// MUI Icons
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Link from 'next/link';

// --- Fetcher for SWR ---
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        try {
            // @ts-ignore
            error.info = await res.json();
        } catch (e) {
            // @ts-ignore
            error.info = { message: res.statusText };
        }
        // @ts-ignore
        error.status = res.status;
        throw error;
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') {
        return null;
    }
    return res.json();
};


// --- Constants (замініть на реальні значення або спосіб їх отримання) ---
const ORGANIZATION_NAME = "Назва Вашої Організації";
const ORGANIZATION_EDRPOU = "12345678";
const PROTOCOL_CITY_LOCATION = "м. Київ, вул. Прорізна, 2";

// --- Types ---
interface PreviewWriteOffItem {
    instanceId: number;
    quantityToWriteOff: number;
    itemSpecificReason?: string | null;
    inventoryNumber: string;
    assetTypeName: string;
    unitOfMeasure: string;
    unitCost: string;
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
}

type SignatoryData = { full_name: string; position: string | null; role?: CommissionRole; };
type ProtocolItemData = {
    assetTypeName: string;
    quantity: number;
    reason: string | null;
    assetTypeId: number;
    unitOfMeasure: string;
    unitCost?: string;
    inventoryNumber: string;
    instanceId: number;
};
type ProtocolDataResponse = {
    protocolDate: string;
    organizationName: string;
    organizationCode: string;
    documentNumber?: string | null;
    headOfEnterprise: SignatoryData | null;
    chiefAccountant: SignatoryData | null;
    responsiblePerson: SignatoryData | null;
    commission: { chair: SignatoryData | null; members: SignatoryData[]; };
    items: ProtocolItemData[];
    totalSum: string;
    mainReason?: string | null;
    mainNotes?: string | null;
};

interface AffectedAssetInstanceItem {
    instanceId: number;
    quantityToWriteOff: number;
    itemSpecificReason?: string | null;
}
interface BatchInstanceWriteOffDto {
    writeOffDate?: string;
    mainReason?: string | null;
    mainNotes?: string | null;
    writeOffDocumentNumber?: string | null;
    commissionChairId?: number | null;
    headOfEnterpriseSignatoryId?: number | null;
    chiefAccountantSignatoryId?: number | null;
    commissionMemberIds?: number[];
    items: AffectedAssetInstanceItem[];
}

type PerformWriteOffResponse = { message: string; processedWriteOffLogs?: number; };
type ApiErrorData = { message: string; details?: any };
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;


const generateProtocolHtml = (data: ProtocolDataResponse): string => {
    const chair = data.commission.chair;
    const members = data.commission.members;
    const head = data.headOfEnterprise;
    const accountant = data.chiefAccountant;
    const responsible = data.responsiblePerson;

    let calculatedTotalSum = 0;
    const itemsHtml = data.items.map((item, index) => {
        const itemCost = item.unitCost ? Number(String(item.unitCost).replace(',', '.')) : 0;
        const itemSum = !isNaN(itemCost) ? itemCost * item.quantity : 0;
        if (!isNaN(itemSum)) { calculatedTotalSum += itemSum; }
        const displayReason = item.reason ?? data.mainReason ?? '';
        return `
            <tr>
                <td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid black; padding: 5px;">${item.assetTypeName || 'N/A'}</td>
                <td style="border: 1px solid black; padding: 5px;">${item.inventoryNumber || ''}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: center;">${item.unitOfMeasure || 'шт.'}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.quantity}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.unitCost || '-'}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.unitCost && !isNaN(itemSum) ? itemSum.toFixed(2) : '-'}</td>
                <td style="border: 1px solid black; padding: 5px;">${displayReason}</td>
            </tr>
        `;
        }).join('');

    const displayTotalSum = data.totalSum ? parseFloat(data.totalSum).toFixed(2) : calculatedTotalSum.toFixed(2);

    const renderSignatureRow = (roleText: string, signatory: SignatoryData | null) => {
        if (!signatory || !signatory.full_name) return ``;
        return `
             <div class="signature-row">
                 <span class="signature-role">${signatory?.position || roleText}</span>
                 <span class="signature-line"></span>
                 <span class="signature-name">${signatory?.full_name || ''}</span>
             </div>
             <div style="text-align: center;"><span class="signature-label">(посада) (підпис) (Власне ім’я ПРІЗВИЩЕ)</span></div>
        `;
    };
    const actNumberDisplay = data.documentNumber ? data.documentNumber : "____";

    return `
        <!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>Акт Списання Запасів</title><style>
        .css-0{margin:20px 20px 20px 80px} @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 15mm; } .no-print { display: none !important; } }
        body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid black; padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
        th { background-color: #f2f2f2 !important; text-align: center; font-weight: bold; }
        .header, .approval { text-align: right; margin-bottom: 20px; width: 45%; margin-left: 55%;}
        .org-info { text-align: left; margin-bottom: 20px; width: 45%;}
        .top-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .doc-title { text-align: center; margin-bottom: 15px; } .commission { margin-top: 20px; }
        .signatures { margin-top: 40px; page-break-inside: avoid; }
        .signature-row { display: flex; align-items: flex-end; margin-top: 25px; }
        .signature-role { width: 250px; flex-shrink: 0; }
        .signature-line { flex-grow: 1; border-bottom: 1px solid black; margin: 0 10px; min-width: 100px; }
        .signature-name { width: 250px; flex-shrink: 0; text-align: right; }
        .signature-label { font-size: 10px; text-align: center; } p { margin: 5px 0; } .smaller-text { font-size: 10px; }
        </style></head><body>
        <div class="top-section"><div class="org-info">${data.organizationName || ''}<br/><span class="smaller-text"></span><br/>Ідентифікаційний код<br/>за ЄДРПОУ ${data.organizationCode || ''}</div>
        <div class="approval">ЗАТВЕРДЖУЮ<br/>${head ? head.position || 'Керівник підприємства' : 'Керівник підприємства'}<br/><span class="smaller-text"></span><br/>_________ <span class="signature-line"></span><br/><span class="smaller-text">(Підпис)</span> ${head?.full_name || ''}<br/>«___» ____________ ${new Date(data.protocolDate).getFullYear()} р.</div></div>
        <div class="doc-title"><h2>АКТ № ${actNumberDisplay}</h2><h3>списання запасів</h3><p>від ${new Date(data.protocolDate).toLocaleDateString('uk-UA')}</p><p>${PROTOCOL_CITY_LOCATION}</p></div>
        <div class="commission"><p>Комісія, призначена наказом від «___» ____________ 20__ р. № ____ у складі:</p>
        <p>Голова комісії: ${chair ? `${chair.position || 'Голова комісії'} ${chair.full_name}` : ''}</p>
        <p>Члени комісії:</p>${members.map(m => `<p>${m.position || 'Член комісії'} ${m.full_name}</p>`).join('')}
        ${members.length === 0 ? '<p>-</p>' : ''}
        <p>здійснила перевірку запасів${responsible ? `, що знаходяться в ${responsible.position || ''} та обліковуються у матеріально-відповідальної особи ${responsible.full_name}` : ''}</p>
        <p>та встановила, що описані нижче матеріальні цінності підлягають списанню та вилученню з бухгалтерського обліку${data.mainReason ? ` з причини: ${data.mainReason}` : ''}:</p>
        ${data.mainNotes ? `<p>Примітки: ${data.mainNotes}</p>`: ''}
        </div>
        <table><thead><tr><th>№ п/п</th><th>Найменування або однорідна група (вид)</th><th>Номенкл. номер*</th><th>Одиниця виміру</th><th>Кількість</th><th>Вартість за од.</th><th>Сума</th><th>Підстава для списання</th></tr></thead>
        <tbody>${itemsHtml}<tr><td colspan="6" style="border: 1px solid black; padding: 5px; text-align: right; font-weight: bold;">РАЗОМ:</td><td style="border: 1px solid black; padding: 5px; text-align: right;">${displayTotalSum}</td><td style="border: 1px solid black; padding: 5px;"></td></tr></tbody></table>
        <p class="smaller-text">*заповнюються у разі ведення обліку за номенклатурними номерами</p>
        <p>Усього за цим актом списано на загальну суму __________________________________</p><p style="text-align: center;" class="smaller-text">(сума прописом)</p>
        <div class="signatures">
        ${renderSignatureRow('Голова комісії', chair)}
        ${members.map(m => renderSignatureRow('Член комісії', m)).join('')}
        ${renderSignatureRow('Матеріально-відповідальна особа', responsible)}
        ${renderSignatureRow('Головний бухгалтер', accountant)}
        </div></body></html>
    `;
};

export default function ProtocolPreviewPage() {
    const router = useRouter();
    const [pendingData, setPendingData] = React.useState<PendingWriteOffActPreviewData | null>(null);
    const [protocolDataForDisplay, setProtocolDataForDisplay] = React.useState<ProtocolDataResponse | null>(null);
    const [apiPayload, setApiPayload] = React.useState<BatchInstanceWriteOffDto | null>(null);

    const [error, setError] = React.useState<string | null>(null);
    const [isLoadingPage, setIsLoadingPage] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);
    const protocolHtmlRef = React.useRef<string | null>(null); // Завершено ;

    const employeeIdsToFetch = React.useMemo(() => {
        if (!pendingData) return [];
        const ids = new Set<number>();
        if (pendingData.commissionChairId) ids.add(pendingData.commissionChairId);
        if (pendingData.headOfEnterpriseSignatoryId) ids.add(pendingData.headOfEnterpriseSignatoryId);
        if (pendingData.chiefAccountantSignatoryId) ids.add(pendingData.chiefAccountantSignatoryId);
        pendingData.commissionMemberIds?.forEach(id => ids.add(id));
        return Array.from(ids);
    }, [pendingData]);

    const { data: fetchedSignatories, error: signatoriesError } = useSWR<Employee[]>(
        employeeIdsToFetch.length > 0 ? `/api/employees?ids=${employeeIdsToFetch.join(',')}` : null,
        fetcher
    );

    const { data: responsibleEmployee, error: responsibleEmployeeError } = useSWR<Employee | null>(
        pendingData ? '/api/employees/responsible' : null,
        fetcher
    );

    React.useEffect(() => {
        const rawPendingData = sessionStorage.getItem('pendingWriteOffActData');
        if (rawPendingData) {
            try {
                const parsedData = JSON.parse(rawPendingData) as PendingWriteOffActPreviewData;
                setPendingData(parsedData);
            } catch (e) {
                console.error("Error parsing pendingWriteOffActData from sessionStorage:", e);
                setError('Помилка читання даних для попереднього перегляду.');
                setIsLoadingPage(false);
            }
        } else {
            setError('Дані для попереднього перегляду не знайдено. Будь ласка, спробуйте сформувати акт знову.');
            setIsLoadingPage(false);
        }
    }, []);

    React.useEffect(() => {
        if (pendingData &&
            (employeeIdsToFetch.length === 0 || (employeeIdsToFetch.length > 0 && fetchedSignatories)) &&
            (responsibleEmployee !== undefined)
           ) {

            const itemsForProtocol: ProtocolItemData[] = pendingData.items.map(item => ({
                instanceId: item.instanceId,
                assetTypeName: item.assetTypeName,
                inventoryNumber: item.inventoryNumber,
                quantity: item.quantityToWriteOff,
                unitOfMeasure: item.unitOfMeasure,
                unitCost: item.unitCost,
                reason: item.itemSpecificReason ?? null,
                assetTypeId: 0, 
            }));

            let totalSumCalc = 0;
            itemsForProtocol.forEach(item => {
                const cost = item.unitCost ? parseFloat(String(item.unitCost).replace(',', '.')) : 0;
                if (!isNaN(cost)) { totalSumCalc += cost * item.quantity; }
            });

            const employeeToSignatoryData = (emp: Employee | null | undefined): SignatoryData | null => {
                if (!emp) return null;
                return { full_name: emp.full_name, position: emp.position, role: emp.commission_role };
            };

            const displayData: ProtocolDataResponse = {
                protocolDate: pendingData.writeOffDate || new Date().toISOString().split('T')[0],
                organizationName: ORGANIZATION_NAME,
                organizationCode: ORGANIZATION_EDRPOU,
                documentNumber: pendingData.writeOffDocumentNumber,
                headOfEnterprise: employeeToSignatoryData(fetchedSignatories?.find(e => e.id === pendingData.headOfEnterpriseSignatoryId)),
                chiefAccountant: employeeToSignatoryData(fetchedSignatories?.find(e => e.id === pendingData.chiefAccountantSignatoryId)),
                commission: {
                    chair: employeeToSignatoryData(fetchedSignatories?.find(e => e.id === pendingData.commissionChairId)),
                    members: pendingData.commissionMemberIds
                                ?.map(id => employeeToSignatoryData(fetchedSignatories?.find(e => e.id === id)))
                                .filter(Boolean) as SignatoryData[] || [],
                },
                responsiblePerson: employeeToSignatoryData(responsibleEmployee),
                items: itemsForProtocol,
                totalSum: totalSumCalc.toFixed(2),
                mainReason: pendingData.mainReason,
                mainNotes: pendingData.mainNotes,
            };
            setProtocolDataForDisplay(displayData);
            protocolHtmlRef.current = generateProtocolHtml(displayData);

            const apiData: BatchInstanceWriteOffDto = {
                writeOffDate: pendingData.writeOffDate,
                mainReason: pendingData.mainReason,
                mainNotes: pendingData.mainNotes,
                writeOffDocumentNumber: pendingData.writeOffDocumentNumber,
                commissionChairId: pendingData.commissionChairId,
                headOfEnterpriseSignatoryId: pendingData.headOfEnterpriseSignatoryId,
                chiefAccountantSignatoryId: pendingData.chiefAccountantSignatoryId,
                commissionMemberIds: pendingData.commissionMemberIds,
                items: pendingData.items.map(pItem => ({
                    instanceId: pItem.instanceId,
                    quantityToWriteOff: pItem.quantityToWriteOff,
                    itemSpecificReason: pItem.itemSpecificReason ?? null,
                })),
            };
            setApiPayload(apiData);
            setIsLoadingPage(false);

        } else if (signatoriesError || responsibleEmployeeError) {
            // ВИПРАВЛЕНО ТУТ:
            const errMsg = `Помилка завантаження даних співробітників: 
                ${signatoriesError ? (signatoriesError as Error).message : ''} 
                ${responsibleEmployeeError ? (responsibleEmployeeError as Error).message : ''}`;
            setError(errMsg.trim());
            console.error("Signatories fetch error:", signatoriesError);
            console.error("Responsible employee fetch error:", responsibleEmployeeError);
            setIsLoadingPage(false);
        }
    }, [pendingData, fetchedSignatories, responsibleEmployee, signatoriesError, responsibleEmployeeError, employeeIdsToFetch]);


    const handlePrint = () => {
        if (protocolHtmlRef.current) {
            const printWindow = window.open('', '_blank', 'height=800,width=800,scrollbars=yes');
            if (printWindow) {
                printWindow.document.write(protocolHtmlRef.current);
                printWindow.document.close();
                setTimeout(() => {
                    try { printWindow.print(); }
                    catch (printError) { console.error("Print error:", printError); setSnackbar({ open: true, message: 'Помилка виклику друку.', severity: 'warning' }); }
                }, 500);
            } else {
                setSnackbar({ open: true, message: 'Не вдалося відкрити вікно для друку. Перевірте блокування спливаючих вікон.', severity: 'warning' });
            }
        }
    };

    const handleConfirmWriteOff = async () => {
        if (!apiPayload) {
            setSnackbar({ open: true, message: 'Немає даних для підтвердження списання.', severity: 'error' });
            return;
        }
        setIsSubmitting(true);
        setSnackbar(null);
        try {
            const response = await fetch('/api/inventory/perform-write-off', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });
            const result: PerformWriteOffResponse | ApiErrorData = await response.json();
            if (!response.ok) { throw new Error((result as ApiErrorData).message || `HTTP error! status: ${response.status}`); }

            setSnackbar({ open: true, message: (result as PerformWriteOffResponse).message || 'Списання успішно зафіксовано!', severity: 'success' });
            sessionStorage.removeItem('pendingWriteOffActData');
            
            await mutate('/api/dashboard/summary');
            await mutate('/api/asset-types');
            await mutate(key => typeof key === 'string' && key.startsWith('/api/asset-instances/write-off-candidates'), undefined, { revalidate: true });
            await mutate('/api/employees/responsible');

            setProtocolDataForDisplay(null);
            setApiPayload(null);
            setPendingData(null);

            setTimeout(() => { router.push('/inventory'); }, 3000);
        } catch (err) {
            console.error("Write-off submission error:", err);
            setSnackbar({ open: true, message: `Помилка підтвердження списання: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
    };

    if (isLoadingPage) {
        return <Container maxWidth="lg" sx={{ py: 3, textAlign: 'center' }}><CircularProgress /></Container>;
    }
    if (error) {
        return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Alert severity="error">{error}</Alert>
                <Button component={Link} href="/inventory/write-off" startIcon={<ArrowBackIcon />} sx={{mt: 2}}>
                    Назад до Формування Списку
                </Button>
            </Container>
        );
    }
    if (!protocolDataForDisplay || !pendingData) {
         return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Немає даних для відображення протоколу або дані некоректні. Будь ласка, поверніться на попередню сторінку та сформуйте його знову.
                </Alert>
                <Button component={Link} href="/inventory/write-off" startIcon={<ArrowBackIcon />}>
                    Назад до Формування Списку
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Paper elevation={3} sx={{ overflow: 'auto', mb: 3 }}>
                {protocolHtmlRef.current ?
                    <Box dangerouslySetInnerHTML={{ __html: protocolHtmlRef.current }} />
                    : <Box sx={{p:3, textAlign: 'center'}}><Typography>Генерація протоколу...</Typography></Box>
                }
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }} className="no-print">
                <Button component={Link} href="/inventory/write-off" startIcon={<ArrowBackIcon />}>
                    Назад до Формування Списку
                </Button>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={handlePrint}
                        disabled={isSubmitting || !protocolHtmlRef.current}
                    >
                        Друк Акту
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={handleConfirmWriteOff}
                        disabled={isSubmitting || !apiPayload}
                    >
                        {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Підтвердити Списання'}
                    </Button>
                </Box>
            </Box>

            {snackbar && (<Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
            </Snackbar>)}
        </Container>
    );
}