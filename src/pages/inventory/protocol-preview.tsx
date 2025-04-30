// pages/inventory/protocol-preview.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import { CommissionRole } from '@prisma/client';
import { mutate } from 'swr';

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

// --- Types ---
type CommissionMemberData = { full_name: string; position: string | null; role: CommissionRole; };
type ProtocolItemData = { assetTypeName: string; quantity: number; reason: string | null; assetTypeId: number; };
type ProtocolDataResponse = {
    protocolDate: string;
    commission: { chair: CommissionMemberData | null; members: CommissionMemberData[]; };
    items: ProtocolItemData[];
};
type PerformWriteOffResponse = { message: string; createdLogEntries: number; };
type ApiErrorData = { message: string; details?: any };
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;


// --- Helper to Generate Protocol HTML ---
// Визначення функції тут, ОДИН РАЗ
const generateProtocolHtml = (data: ProtocolDataResponse): string => {
    const chair = data.commission.chair;
    const members = data.commission.members;
    const itemsHtml = data.items.map((item, index) => `
        <tr>
            <td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid black; padding: 5px;">${item.assetTypeName || 'N/A'}</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.quantity}</td>
            <td style="border: 1px solid black; padding: 5px;">${item.reason || ''}</td>
        </tr>
    `).join('');

    // Покращений HTML шаблон
    return `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <title>Акт Списання Матеріальних Цінностей</title>
            <style>
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 15mm; } .no-print { display: none !important; } }
                body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 12px; }
                th, td { border: 1px solid black; padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
                th { background-color: #f2f2f2 !important; text-align: center; font-weight: bold; }
                .header, .approval { text-align: center; margin-bottom: 20px; }
                .commission { margin-top: 20px; }
                .signatures { margin-top: 40px; page-break-inside: avoid; }
                .signature-row { display: flex; justify-content: space-between; margin-top: 30px; }
                .signature-item { width: 45%; text-align: left; }
                .signature-line { margin-top: 10px; border-bottom: 1px solid black; min-width: 150px; display: inline-block; }
                .signature-label { font-size: 10px; text-align: center; }
                p { margin: 5px 0; }
                .print-button-container { text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="approval">ЗАТВЕРДЖУЮ<br/>_________________________<br/>(Посада керівника)<br/>_________ <span class="signature-line"></span><br/>(Підпис) (Ініціали, прізвище)<br/>«___» ____________ 20__ р.</div>
            <div class="header"><h2>АКТ СПИСАННЯ № ____</h2><h3>матеріальних цінностей</h3><p>від ${new Date(data.protocolDate).toLocaleDateString('uk-UA')}</p></div>
            <div class="commission"><p>Комісія, призначена наказом від «___» ____________ 20__ р. № ____ у складі:</p><p>Голова комісії: ${chair ? `${chair.position || '________________'} ${chair.full_name}` : '_____________________________'}</p><p>Члени комісії:</p>${members.map(m => `<p>${m.position || '________________'} ${m.full_name}</p>`).join('')}${members.length === 0 ? '<p>(Члени комісії не вказані)</p>' : ''}<p>провела огляд матеріальних цінностей, що значаться на балансі установи, та встановила, що наступні підлягають списанню:</p></div>
            <table><thead><tr><th>№ п/п</th><th>Найменування цінностей</th><th>Кількість</th><th>Причина списання</th></tr></thead><tbody>${itemsHtml}</tbody></table>
            <div class="signatures"><p>Висновок комісії: ________________________________________________________________</p><p>________________________________________________________________________________</p><br/><div class="signature-row"><div class="signature-item">Голова комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (${chair ? chair.full_name.split(' ').slice(-1).join(' ') : '_________'})</span></div><div class="signature-item">Головний бухгалтер _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (ініціали, прізвище)</span></div></div>${members.map(m => `<div class="signature-row"><div class="signature-item">Член комісії _________ <span class="signature-line"></span><br/><span class="signature-label">(підпис) (${m.full_name.split(' ').slice(-1).join(' ')})</span></div><div class="signature-item"></div></div>`).join('')}</div>
            <div class="print-button-container no-print"><button onclick="window.print()">Друк</button></div>
        </body>
        </html>
    `;
};


// --- Компонент Сторінки Перегляду Протоколу ---
export default function ProtocolPreviewPage() {
    const router = useRouter();
    const [protocolData, setProtocolData] = React.useState<ProtocolDataResponse | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState<SnackbarState>(null);
    const protocolHtmlRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        setIsLoading(true);
        setError(null);
        setProtocolData(null);
        protocolHtmlRef.current = null;

        try {
            const dataString = sessionStorage.getItem('protocolPreviewData');
            if (dataString) {
                const parsedData = JSON.parse(dataString) as ProtocolDataResponse;
                if (parsedData && parsedData.items && parsedData.items.length > 0) {
                    setProtocolData(parsedData);
                    protocolHtmlRef.current = generateProtocolHtml(parsedData);
                } else {
                     setError('Не знайдено даних для формування протоколу в сесії.');
                }
            } else {
                setError('Дані для протоколу не знайдено. Можливо, сторінку було оновлено або дані сесії втрачено. Будь ласка, поверніться та спробуйте згенерувати протокол знову.');
            }
        } catch (e) {
            console.error("Error reading or parsing protocol data:", e);
            setError('Помилка при завантаженні даних для протоколу.');
        } finally {
             setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Обробник Друку ---
    // Визначення функції тут, ОДИН РАЗ
    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'height=800,width=800,scrollbars=yes');
        if (printWindow && protocolHtmlRef.current) {
            printWindow.document.write(protocolHtmlRef.current);
            printWindow.document.close();
             setTimeout(() => {
                try { printWindow.print(); }
                catch (printError) { console.error("Print error:", printError); alert('Помилка виклику друку. Спробуйте вручну (Ctrl+P).'); }
             }, 500);
        } else if (!printWindow) {
             alert('Не вдалося відкрити вікно для друку. Перевірте блокування спливаючих вікон.');
        }
    };


    // --- Обробник Підтвердження Списання ---
    const handleConfirmWriteOff = async () => {
        if (!protocolData || !protocolData.items || protocolData.items.length === 0) {
            setSnackbar({ open: true, message: 'Немає даних для підтвердження списання.', severity: 'error' });
            return;
        }

        setIsSubmitting(true);
        setSnackbar(null);

        const payload = {
            items: protocolData.items.map(item => ({
                assetTypeId: item.assetTypeId,
                quantity: item.quantity,
                reason: item.reason || null,
            })),
        };

        if (payload.items.some(item => typeof item.assetTypeId !== 'number')) {
             setSnackbar({ open: true, message: 'Помилка даних протоколу: не знайдено ID типу активу.', severity: 'error' });
             setIsSubmitting(false);
             return;
        }

        try {
            const response = await fetch('/api/inventory/perform-write-off', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result: PerformWriteOffResponse | ApiErrorData = await response.json();
            if (!response.ok) { throw new Error((result as ApiErrorData).message || `HTTP error! status: ${response.status}`); }

            setSnackbar({ open: true, message: (result as PerformWriteOffResponse).message || 'Списання успішно зафіксовано!', severity: 'success' });
            sessionStorage.removeItem('protocolPreviewData');

            await mutate('/api/dashboard/summary');
            await mutate('/api/asset-types');
            console.log("SWR caches revalidated.");

            setTimeout(() => {
                router.push('/inventory');
            }, 2000);

        } catch (err) {
            console.error("Write-off submission error:", err);
            setSnackbar({ open: true, message: `Помилка підтвердження списання: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

     // --- Обробник закриття Snackbar ---
     const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbar(null);
     };


    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
             {/* Кнопки дій (не друкуються) */}
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }} className="no-print">
                 <Button component={Link} href="/inventory/write-off" startIcon={<ArrowBackIcon />}>
                     Назад до Формування Списку
                 </Button>
                 <Box sx={{ display: 'flex', gap: 2 }}>
                     <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={handlePrint} // Використовуємо визначений обробник
                        disabled={isLoading || !!error || !protocolData || isSubmitting}
                     >
                         Друк Акту
                     </Button>
                     <Button
                        variant="contained"
                        color="error"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={handleConfirmWriteOff}
                        disabled={isLoading || !!error || !protocolData || isSubmitting}
                     >
                         {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Підтвердити Списання'}
                     </Button>
                 </Box>
             </Box>

             {/* Область відображення протоколу */}
             <Paper elevation={3} sx={{ overflow: 'auto' }}>
                 {isLoading && ( <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}> <CircularProgress /> </Box> )}
                 {error && !isLoading && ( <Alert severity="error" sx={{ m: 2 }}>{error}</Alert> )}
                 {!isLoading && !error && protocolData && (
                     <Box dangerouslySetInnerHTML={{ __html: protocolHtmlRef.current || '' }} sx={{ p: { xs: 1, sm: 2, md: 3 } }}/>
                 )}
                 {!isLoading && !error && !protocolData && (
                     <Alert severity="info" sx={{ m: 2 }}>Немає даних для відображення протоколу. Будь ласка, поверніться на попередню сторінку та сформуйте його.</Alert>
                 )}
             </Paper>

              {/* --- Snackbar --- */}
           {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                 <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
               </Snackbar>
           )}
        </Container>
    );
}
