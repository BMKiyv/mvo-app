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
type SignatoryData = { full_name: string; position: string | null; role?: CommissionRole; };
type ProtocolItemData = { assetTypeName: string; quantity: number; reason: string | null; assetTypeId: number; unitOfMeasure: string; unitCost?: string; /* Додамо вартість, якщо API її поверне */ };
type ProtocolDataResponse = {
    protocolDate: string;
    organizationName: string;
    organizationCode: string;
    headOfEnterprise: SignatoryData | null;
    chiefAccountant: SignatoryData | null;
    responsiblePerson: SignatoryData | null;
    commission: { chair: SignatoryData | null; members: SignatoryData[]; };
    items: ProtocolItemData[];
};
type PerformWriteOffResponse = { message: string; createdLogEntries: number; };
type ApiErrorData = { message: string; details?: any };
type SnackbarState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; } | null;


// --- Helper to Generate Protocol HTML (Оновлено) ---
const generateProtocolHtml = (data: ProtocolDataResponse): string => {
    const chair = data.commission.chair;
    const members = data.commission.members;
    const head = data.headOfEnterprise;
    const accountant = data.chiefAccountant;
    const responsible = data.responsiblePerson;

    // Розрахунок загальної суми (поки заглушка, потрібна unitCost)
    let totalSum = 0;
    const itemsHtml = data.items.map((item, index) => {
        // const itemSum = item.unitCost ? (Number(item.unitCost) * item.quantity) : 0;
        // totalSum += itemSum;
        return `
            <tr>
                <td style="border: 1px solid black; padding: 5px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid black; padding: 5px;">${item.assetTypeName || 'N/A'}</td>
                <td style="border: 1px solid black; padding: 5px;"></td> {/* Номенкл. номер */}
                <td style="border: 1px solid black; padding: 5px; text-align: center;">${item.unitOfMeasure || 'шт.'}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.quantity}</td>
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.unitCost || '-'}</td> {/* Вартість */}
                <td style="border: 1px solid black; padding: 5px; text-align: right;">${item.unitCost ? (Number(item.unitCost) * item.quantity).toFixed(2) : '-'}</td> {/* Сума */}
                <td style="border: 1px solid black; padding: 5px;">${item.reason || ''}</td>
            </tr>
        `;
        }).join('');

    // Функція для безпечного отримання ПІБ для підпису (Прізвище І.Б.) - без змін
    // const getSignatoryLastNameInitial = (signatory: SignatoryData | null): string => { 
    //             if (!signatory || !signatory.full_name) return '_________';
    //     const parts = signatory.full_name.trim().split(' ');
    //     if (parts.length > 0) {
    //         let initials = '';
    //         if (parts.length > 1) initials += ` ${parts[1][0]}.`;
    //         if (parts.length > 2) initials += `${parts[2][0]}.`;
    //         // Повертає Прізвище І.Б.
    //         return `${parts[0]}${initials}`;
    //     }
    //     return signatory.full_name; // Fallback
    
    //  };
    // --- Re-add implementation ---
     const getSignatoryLastNameInitial = (signatory: SignatoryData | null): string => {
        if (!signatory || !signatory.full_name) return ''; // Повертаємо порожній рядок, якщо немає даних
        const parts = signatory.full_name.trim().split(' ');
        if (parts.length > 0) {
            let initials = '';
            if (parts.length > 1) initials += ` ${parts[1][0]}.`;
            if (parts.length > 2) initials += `${parts[2][0]}.`;
            return `${parts[0]}${initials}`;
        }
        return signatory.full_name;
    };


    // Оновлений HTML шаблон з усіма підписантами та структурою
    return `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <title>Акт Списання Запасів</title>
            <style>
                /* Стилі без змін */
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 15mm; } .no-print { display: none !important; } }
                body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.4; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 12px; }
                th, td { border: 1px solid black; padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
                th { background-color: #f2f2f2 !important; text-align: center; font-weight: bold; }
                .header, .approval { text-align: right; margin-bottom: 20px; width: 45%; margin-left: 55%;}
                .org-info { text-align: left; margin-bottom: 20px; width: 45%;}
                .top-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .doc-title { text-align: center; margin-bottom: 15px; }
                .commission { margin-top: 20px; }
                .signatures { margin-top: 40px; page-break-inside: avoid; }
                /* Оновлені стилі для підписів */
                .signature-row { display: flex; align-items: flex-end; margin-top: 25px; } /* Вирівнюємо по нижньому краю */
                .signature-role { width: 150px; /* Фіксована ширина для ролі */ flex-shrink: 0; }
                .signature-line { flex-grow: 1; /* Лінія займає доступний простір */ border-bottom: 1px solid black; margin: 0 10px; }
                .signature-name { width: 200px; /* Фіксована ширина для імені */ flex-shrink: 0; }
                .signature-label { font-size: 10px; text-align: center; }
                .signature-m { margin-right: 90px; }
                p { margin: 5px 0; }
                .smaller-text { font-size: 10px; }
            </style>
        </head>
        <body>
             <div class="top-section">
                 <div class="org-info">
                    ${data.organizationName || '____________________'}<br/>
                    <span class="smaller-text"></span><br/> 
                    Ідентифікаційний код<br/>
                    за ЄДРПОУ ${data.organizationCode || '____________________'}
                 </div>
                 <div class="approval">
                    ЗАТВЕРДЖУЮ<br/>
                    ${head ? head.position || '____________________' : '____________________'}<br/>
                    <span class="smaller-text"></span><br/> 
                    _________ <span class="signature-line"></span><span>${getSignatoryLastNameInitial(head)}</span><br/>
                    <span class="smaller-text signature-m">(Підпис)</span> <br/>
                    «___» ____________ ${new Date(data.protocolDate).getFullYear()} р.
                 </div>
            </div>

            <div class="doc-title">
                <h2>АКТ № ____</h2> 
                <h3>списання запасів</h3>
                <p>від ${new Date(data.protocolDate).toLocaleDateString('uk-UA')}</p>
                <p>м. Київ, вул. Прорізна, 2</p> 
            </div>

            <div class="commission">
                <p>Комісія, призначена наказом від «___» ____________ 20__ р. № ____ у складі:</p>
                <p>Голова комісії: ${chair ? `${chair.position || ''} ${chair.full_name}` : ''}</p>
                <p>Члени комісії:</p>
                ${members.map(m => `<p>${m.position || ''} ${m.full_name}</p>`).join('')}
                ${members.length === 0 ? '<p>-</p>' : ''}
                <p>здійснила перевірку запасів, що знаходяться в ${responsible ? responsible.position || '' : ''} та обліковуються у матеріально-відповідальної особи ${responsible ? responsible.full_name : ''}</p>
                <p>та встановила, що описані нижче матеріальні цінності підлягають списанню та вилученню з бухгалтерського обліку:</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>№ п/п</th>
                        <th>Найменування або однорідна група (вид)</th>
                        <th>Номенкл. номер*</th>
                        <th>Одиниця виміру</th>
                        <th>Кількість</th>
                        <th>Вартість за од.</th>
                        <th>Сума</th>
                        <th>Підстава для списання</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                     <tr>
                         <td colspan="6" style="border: 1px solid black; padding: 5px; text-align: right; font-weight: bold;">РАЗОМ:</td>
                         <td style="border: 1px solid black; padding: 5px; text-align: right;">${totalSum > 0 ? totalSum.toFixed(2) : '-'}</td> {/* TODO: Розрахувати суму */}
                         <td style="border: 1px solid black; padding: 5px;"></td>
                     </tr>
                </tbody>
            </table>
            <p class="smaller-text">*заповнюються у разі ведення обліку за номенклатурними номерами</p>
            <p>Усього за цим актом списано на загальну суму __________________________________</p>
            <p style="text-align: center;" class="smaller-text">(сума прописом)</p>


             <div class="signatures">
                 {/* Оновлений блок підписів */}
                 <div class="signature-row">
                     <span class="signature-role">Голова комісії</span>
                     <span class="signature-line"></span>
                     <span class="signature-name">${chair?.full_name || ''}</span>
                 </div>
                 <div style="text-align: center;"><span class="signature-label">(підпис)</span></div>

                 ${members.map(m => `
                    <div class="signature-row">
                         <span class="signature-role">Член комісії</span>
                         <span class="signature-line"></span>
                         <span class="signature-name">${m.full_name || ''}</span>
                     </div>
                     <div style="text-align: center;"><span class="signature-label">(підпис)</span></div>
                 `).join('')}

                  <div class="signature-row">
                     <span class="signature-role">Матеріально-відповідальна особа</span>
                     <span class="signature-line"></span>
                     <span class="signature-name">${responsible?.full_name || ''}</span>
                 </div>
                 <div style="text-align: center;"><span class="signature-label">(підпис)</span></div>

                 <div class="signature-row">
                     <span class="signature-role">Головний бухгалтер</span>
                     <span class="signature-line"></span>
                     <span class="signature-name">${accountant?.full_name || ''}</span>
                 </div>
                  <div style="text-align: center;"><span class="signature-label">(підпис)</span></div>
             </div>
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
                if (parsedData && Array.isArray(parsedData.items) && parsedData.items.length > 0 && parsedData.items.every(item => typeof item.assetTypeId === 'number') && parsedData.commission) {
                    setProtocolData(parsedData);
                    protocolHtmlRef.current = generateProtocolHtml(parsedData);
                } else {
                     console.error("Invalid protocol data structure in sessionStorage:", parsedData);
                     setError('Некоректні дані для формування протоколу в сесії.');
                     sessionStorage.removeItem('protocolPreviewData');
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
    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'height=800,width=800,scrollbars=yes');
        if (printWindow && protocolHtmlRef.current) {
            printWindow.document.write(protocolHtmlRef.current);
            printWindow.document.close();
             setTimeout(() => {
                try { printWindow.print(); }
                catch (printError) { console.error("Print error:", printError); setSnackbar({ open: true, message: 'Помилка виклику друку. Спробуйте вручну (Ctrl+P).', severity: 'warning' }); }
             }, 500);
        } else if (!printWindow) {
             setSnackbar({ open: true, message: 'Не вдалося відкрити вікно для друку. Перевірте блокування спливаючих вікон.', severity: 'warning' });
        }
    };

    // --- Обробник Підтвердження Списання ---
    const handleConfirmWriteOff = async () => {
        if (!protocolData || !protocolData.items || protocolData.items.length === 0) {
            setSnackbar({ open: true, message: 'Немає даних для підтвердження списання.', severity: 'error' });
            return;
        }
        if (protocolData.items.some(item => typeof item.assetTypeId !== 'number')) {
             setSnackbar({ open: true, message: 'Помилка даних протоколу: не знайдено ID типу активу для всіх позицій.', severity: 'error' });
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

            setProtocolData(null); // Блокуємо кнопки

            setTimeout(() => {
                router.push('/inventory');
            }, 3000);

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
             {/* Область відображення протоколу */}
             <Paper elevation={3} sx={{ overflow: 'auto', mb: 3 }}>
                 {isLoading && ( <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}> <CircularProgress /> </Box> )}
                 {error && !isLoading && ( <Alert severity="error" sx={{ m: 2 }}>{error}</Alert> )}
                 {!isLoading && !error && protocolData && (
                     <Box dangerouslySetInnerHTML={{ __html: protocolHtmlRef.current || '' }} sx={{ p: { xs: 1, sm: 2, md: 3 } }}/>
                 )}
                 {!isLoading && !error && !protocolData && (
                     <Alert severity="info" sx={{ m: 2 }}>Немає даних для відображення протоколу. Будь ласка, поверніться на попередню сторінку та сформуйте його.</Alert>
                 )}
             </Paper>

              {/* Кнопки дій (тепер під протоколом) */}
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }} className="no-print">
                 <Button component={Link} href="/inventory/write-off" startIcon={<ArrowBackIcon />}>
                     Назад до Формування Списку
                 </Button>
                 {/* Показуємо кнопки тільки якщо є дані для протоколу */}
                 {protocolData && (
                     <Box sx={{ display: 'flex', gap: 2 }}>
                         <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={handlePrint}
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
                 )}
             </Box>


              {/* --- Snackbar --- */}
           {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                 <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
               </Snackbar>
           )}
        </Container>
    );
}
