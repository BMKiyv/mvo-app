// pages/archive/index.tsx (Або ваш відповідний шлях)
import React, { useState } from 'react';
import useSWR from 'swr';
import {
    Container, Typography, Box, Tabs, Tab, CircularProgress, Alert, Paper
} from '@mui/material';
import { format, isValid } from 'date-fns'; // Додаємо isValid для перевірки дати
import { uk } from 'date-fns/locale'; // Імпортуємо українську локаль для date-fns
import { Decimal } from '@prisma/client/runtime/library'; // Потрібно для типу Decimal

// --- Типи даних (оновлено для відповіді API списань) ---

// Тип для деактивованих співробітників (залишаємо без змін, якщо API /api/archive/employees не змінювався)
interface ArchivedEmployeeData {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
}

// Тип для даних з WriteOffLog, як визначено в бекенді
// !!! Важливо: Ця структура має ТОЧНО відповідати тій, що повертає ваш API /api/archive/asset-instances !!!
type ArchivedWriteOffLogData = {
    id: number;
    writeOffDate: string | Date; // API може повертати як рядок, обробимо це
    quantity: number;
    unitCostAtWriteOff: Decimal | number | string | null; // Адаптуємо до можливих типів
    totalValueAtWriteOff: Decimal | number | string | null; // Адаптуємо до можливих типів
    writeOffDocumentNumber: string | null;
    operationType: string; // Наприклад, INSTANCE_DISPOSAL, INSTANCE_PARTIAL_REDUCTION
    assetInstance: {
        inventoryNumber: string | null;
    } | null;
    assetType: {
        name: string | null;
        unit_of_measure: string | null;
    } | null;
    displayNotes: string | null; // Примітки (з поля reason)
    logNotes: string | null; // Оригінальні нотатки з логу (якщо потрібні)
    responsibleEmployeeName: string | null;
    commissionChairName: string | null;
    headOfEnterpriseSignatoryName: string | null;
    chiefAccountantSignatoryName: string | null;
    commissionMemberNames: string[];
};


// --- Функція для завантаження даних через fetch ---
const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        let errorInfo = 'Помилка завантаження даних.';
        try {
            const data = await res.json();
            errorInfo = data.message || errorInfo;
        } catch (e) { /* ignore */ }
        const error = new Error(errorInfo) as Error & { status?: number };
        error.status = res.status;
        throw error;
    }
    // Перевіряємо Content-Type перед парсингом JSON
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') !== -1) {
        return res.json();
    }
    // Повертаємо null або текст, якщо відповідь не JSON
    console.warn(`Received non-JSON response from ${url}`);
    return null;
};

// --- Допоміжний компонент для рядка даних ---
interface ColumnConfig<T> {
    field: keyof T | string; // Може бути ключ або довільний рядок для складних полів
    header: string;
    width?: string | number;
    flex?: number;
    render?: (item: T) => React.ReactNode; // Функція для кастомного рендеру
    align?: 'left' | 'right' | 'center';
    isDate?: boolean; // Прапорець для форматування дати
}

interface DataRowProps<T> {
    item: T;
    columns: ColumnConfig<T>[];
}

// Допоміжна функція для безпечного форматування дати
const formatSafeDate = (dateInput: string | Date | null | undefined, formatString: string = 'dd.MM.yyyy HH:mm'): string => {
    if (!dateInput) return '-';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isValid(date)) {
            return format(date, formatString, { locale: uk });
        }
        return '-';
    } catch (e) {
        console.error("Date formatting error:", e);
        return '-';
    }
};

// Допоміжна функція для форматування чисел (включаючи Decimal)
const formatNumber = (value: Decimal | number | string | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    // Спроба конвертувати Decimal або рядок у число
    const num = typeof value === 'object' && value !== null && 'toNumber' in value
        ? value.toNumber() // Обробка Decimal
        : typeof value === 'string'
        ? parseFloat(value)
        : value;

    if (typeof num === 'number' && !isNaN(num)) {
         // Форматуємо з двома знаками після коми
        return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '-'; // Повертаємо прочерк, якщо не вдалося відформатувати
};


function DataRow<T>({ item, columns }: DataRowProps<T>) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 }
            }}
        >
            {columns.map((col, index) => {
                // Ініціалізуємо cellContent безпечним значенням за замовчуванням
                let cellContent: React.ReactNode = '-';

                try {
                    if (col.render) {
                        // Використовуємо кастомну функцію рендеру, якщо вона є
                        cellContent = col.render(item);
                    } else {
                        // Якщо немає рендера, отримуємо значення за полем
                        // @ts-ignore - Все ще потрібен для гнучкості імені поля (string vs keyof T)
                        const value = item[col.field as keyof T];

                        if (col.isDate) {
                             // Обробка дати
                            cellContent = formatSafeDate(value as string | Date);
                        } else if (['totalValueAtWriteOff', 'unitCostAtWriteOff'].includes(col.field as string)) {
                             // Обробка специфічних числових полів (включаючи Decimal)
                            cellContent = formatNumber(value as Decimal | number | string | null);
                        } else {
                            // Загальний випадок для інших полів
                            if (value === null || value === undefined) {
                                cellContent = '-'; // Залишаємо прочерк для null/undefined
                            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                cellContent = value; // Примітивні типи присвоюємо напряму
                            } else {
    if (typeof value === 'symbol') {
        // Обробляємо символ явно, використовуючи його метод toString()
        cellContent = value.toString(); // Наприклад, поверне "Symbol(description)"
    } else {
        // Для всіх інших не-примітивних, не-символьних типів
        // використовуємо загальне перетворення на рядок
        cellContent = String(value); // Наприклад, для об'єктів це дасть "[object Object]"
    }
                            }
                        }
                    }
                } catch (e) {
                     console.error(`Error rendering cell for field "${String(col.field)}":`, e);
                     cellContent = 'Помилка'; // Показати помилку в комірці
                }


                return (
                    <Box
                        key={index}
                        sx={{
                            width: col.width,
                            flex: col.flex,
                            px: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textAlign: col.align || 'left',
                        }}
                    >
                         {/* Використовуємо title лише якщо cellContent є рядком */}
                        <Typography variant="body2" component="span" title={typeof cellContent === 'string' ? cellContent : undefined}>
                            {cellContent}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}

// --- Компонент Сторінки Архіву ---
const ArchivePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0); // Починаємо з першої вкладки

    // --- SWR Hooks ---
    const { data: employeesData, error: employeesError, isLoading: employeesLoading } = useSWR<ArchivedEmployeeData[]>(
        activeTab === 0 ? '/api/archive/employees' : null, fetcher
    );
    // Оновлюємо тип для useSWR
    const { data: assetsData, error: assetsError, isLoading: assetsLoading } = useSWR<ArchivedWriteOffLogData[]>(
        activeTab === 1 ? '/api/archive/asset-instances' : null, fetcher
    );

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    // --- Конфігурація колонок для співробітників (без змін) ---
    const employeeColumnsConfig: ColumnConfig<ArchivedEmployeeData>[] = [
        { field: 'id', header: 'ID', width: '80px' },
        { field: 'full_name', header: 'ПІБ', flex: 3 },
        { field: 'position', header: 'Посада', flex: 2 },
        { field: 'contact_info', header: 'Контакти', flex: 2 },
    ];

    // --- Оновлена конфігурація колонок для Списаних Активів (WriteOffLog) ---
    const assetLogColumnsConfig: ColumnConfig<ArchivedWriteOffLogData>[] = [
         // ID самого запису логу списання
        { field: 'id', header: 'ID Запису', width: '100px' },
        {
            field: 'writeOffDate', // Поле з датою списання
            header: 'Дата списання',
            width: '140px',
            isDate: true, // Вказуємо, що це дата для форматування
            align: 'center',
        },
         {
            field: 'writeOffDocumentNumber', // Номер документа списання
            header: '№ Документа',
            width: '130px',
        },
         {
            field: 'inventoryNumber', // Кастомний рендер для інв. номера
            header: 'Інв. №',
            width: '130px',
            render: (item) => item.assetInstance?.inventoryNumber ?? '-', // Обробка null
        },
        {
            field: 'assetTypeName', // Кастомний рендер для типу
            header: 'Тип активу',
            flex: 2,
            render: (item) => item.assetType?.name || 'N/A',
        },
         {
            field: 'quantity', // Кількість, що списана в цій операції
            header: 'Списано (к-сть)',
            width: '130px',
            align: 'right',
        },
         {
            field: 'totalValueAtWriteOff', // Загальна вартість списаного в цій операції
            header: 'Вартість списаного',
            width: '160px',
            align: 'right',
            // Форматування числа відбувається в DataRow за іменем поля
        },
         {
            field: 'displayNotes', // Примітки (з поля reason)
            header: 'Причина / Примітки',
            flex: 3, // Більше місця
            render: (item) => item.displayNotes || '-', // Відображаємо displayNotes
        },
        // Можна додати інші колонки за потреби:
        // { field: 'operationType', header: 'Тип операції', width: '150px' },
        // { field: 'responsibleEmployeeName', header: 'Відповідальний', flex: 2 },
        // { field: 'commissionChairName', header: 'Голова комісії', flex: 2 },
        // { field: 'commissionMemberNames', header: 'Члени комісії', flex: 3, render: (item) => item.commissionMemberNames.join(', ') || '-' },
    ];

    // --- Рендер заголовка таблиці ---
    const renderHeader = (columns: ColumnConfig<any>[]) => (
         <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1,
                px: 1,
                borderBottom: '2px solid',
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
            }}
        >
            {columns.map((col, index) => (
                <Box
                    key={index}
                    sx={{
                        width: col.width,
                        flex: col.flex,
                        px: 1,
                        textAlign: col.align || 'left',
                    }}
                >
                    <Typography variant="subtitle2" fontWeight="bold">
                        {col.header}
                    </Typography>
                </Box>
            ))}
        </Box>
    );

    // --- Логіка рендеру вмісту вкладок ---
    const renderContent = () => {
        if (activeTab === 0) { // Вкладка Співробітники
            if (employeesLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>;
            if (employeesError) return <Alert severity="error" sx={{ mt: 2 }}>Помилка завантаження співробітників: {employeesError.message}</Alert>;
            if (!employeesData || employeesData.length === 0) return <Typography sx={{ mt: 2 }}>Деактивовані співробітники відсутні.</Typography>;

            return (
                 <Paper sx={{ mt: 2, overflow: 'hidden' }}>
                    {renderHeader(employeeColumnsConfig)}
                    <Box sx={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {employeesData.map(employee => (
                            <DataRow key={employee.id} item={employee} columns={employeeColumnsConfig} />
                        ))}
                    </Box>
                </Paper>
            );
        } else { // Вкладка Активи (тепер це Лог списань)
            if (assetsLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>;
            if (assetsError) return <Alert severity="error" sx={{ mt: 2 }}>Помилка завантаження логу списань: {assetsError.message}</Alert>;
            if (!assetsData || assetsData.length === 0) return <Typography sx={{ mt: 2 }}>Записи про списання відсутні.</Typography>;

             // Використовуємо нову конфігурацію колонок assetLogColumnsConfig
            return (
                 <Paper sx={{ mt: 2, overflow: 'hidden' }}>
                      {renderHeader(assetLogColumnsConfig)}
                     <Box sx={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {assetsData.map(logEntry => (
                            // Використовуємо logEntry.id як ключ
                            <DataRow key={logEntry.id} item={logEntry} columns={assetLogColumnsConfig} />
                        ))}
                    </Box>
                </Paper>
            );
        }
    };

    // --- Основний рендер сторінки ---
    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom component="h1">
                Архів
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="Вкладки архіву">
                    <Tab label="Деактивовані співробітники" id="archive-tab-0" aria-controls="archive-tabpanel-0" />
                    <Tab label="Журнал Списань" id="archive-tab-1" aria-controls="archive-tabpanel-1" /> {/* Змінено назву вкладки */}
                </Tabs>
            </Box>
             <Box
                role="tabpanel"
                hidden={activeTab !== 0}
                id="archive-tabpanel-0"
                aria-labelledby="archive-tab-0"
            >
                {activeTab === 0 && renderContent()}
            </Box>
            <Box
                role="tabpanel"
                hidden={activeTab !== 1}
                id="archive-tabpanel-1"
                aria-labelledby="archive-tab-1"
            >
                 {activeTab === 1 && renderContent()}
            </Box>
        </Container>
    );
};

export default ArchivePage;