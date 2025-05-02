import React, { useState } from 'react';
import useSWR from 'swr';
import {
    Container, Typography, Box, Tabs, Tab, CircularProgress, Alert, Paper, Divider
} from '@mui/material';
import { format } from 'date-fns'; // Для форматування дати

// Припустимо, у вас є спільний Layout компонент
// import Layout from '../../components/Layout';

// --- Типи даних (мають відповідати відповідям ваших API) ---
// (Залишаємо ті самі типи, що й раніше)
interface ArchivedEmployeeData {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
}

interface IncludedAssetTypeData {
    name: string;
    unit_of_measure: string | null;
}

interface ArchivedAssetInstanceData {
    id: number;
    inventoryNumber: string | null;
    quantity: number;
    unit_cost: number | string | null;
    purchase_date: string | Date | null;
    notes: string | null;
    status: string;
    assetType: IncludedAssetTypeData | null;
}

// --- Функція для завантаження даних через fetch ---
// (Залишаємо ту саму функцію fetcher)
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
    return res.json();
};

// --- Допоміжний компонент для рядка даних ---
// Використовуємо дженеріки для типізації даних рядка та конфігурації колонок
interface ColumnConfig<T> {
    field: keyof T | string; // Може бути ключ або довільний рядок для складних полів
    header: string;
    width?: string | number; // Наприклад, '100px' або 10 (для flex-grow)
    flex?: number;
    render?: (item: T) => React.ReactNode; // Функція для кастомного рендеру
    align?: 'left' | 'right' | 'center';
}

interface DataRowProps<T> {
    item: T;
    columns: ColumnConfig<T>[];
}

function DataRow<T>({ item, columns }: DataRowProps<T>) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1, // Вертикальний padding
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 } // Прибрати лінію у останнього
            }}
        >
            {columns.map((col, index) => {
                // Визначаємо вміст комірки
                let cellContent: React.ReactNode;
                if (col.render) {
                    cellContent = col.render(item);
                } else {
                    // @ts-ignore - Доступ за ключем, безпечний, якщо конфіг правильний
                    cellContent = item[col.field as keyof T] ?? '-';
                }

                // Якщо дата, форматуємо
                 if (col.field === 'purchase_date' && cellContent instanceof Date) {
                   try { cellContent = format(cellContent as Date, 'dd.MM.yyyy'); } catch { /* ignore */ }
                 } else if (col.field === 'purchase_date' && typeof cellContent === 'string') {
                   try { cellContent = format(new Date(cellContent), 'dd.MM.yyyy'); } catch { /* ignore */ }
                 }


                return (
                    <Box
                        key={index}
                        sx={{
                            width: col.width,
                            flex: col.flex,
                            px: 1, // Горизонтальний padding
                            overflow: 'hidden', // Обрізати текст, що не вміщується
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', // Заборонити перенос рядків
                            textAlign: col.align || 'left',
                        }}
                    >
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
    const [activeTab, setActiveTab] = useState(0);

    // --- SWR Hooks (без змін) ---
    const { data: employeesData, error: employeesError, isLoading: employeesLoading } = useSWR<ArchivedEmployeeData[]>(
        activeTab === 0 ? '/api/archive/employees' : null, fetcher
    );
    const { data: assetsData, error: assetsError, isLoading: assetsLoading } = useSWR<ArchivedAssetInstanceData[]>(
        activeTab === 1 ? '/api/archive/asset-instances' : null, fetcher
    );

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    // --- Конфігурація колонок для Flexbox макету ---
    const employeeColumnsConfig: ColumnConfig<ArchivedEmployeeData>[] = [
        { field: 'id', header: 'ID', width: '80px' },
        { field: 'full_name', header: 'ПІБ', flex: 3 }, // Займає більше місця
        { field: 'position', header: 'Посада', flex: 2 },
        { field: 'contact_info', header: 'Контакти', flex: 2 },
    ];

    const assetColumnsConfig: ColumnConfig<ArchivedAssetInstanceData>[] = [
        { field: 'id', header: 'ID', width: '70px' },
        { field: 'inventoryNumber', header: 'Інв. №', width: '130px' },
        {
            field: 'assetTypeName', // Довільне ім'я для кастомного рендеру
            header: 'Тип активу',
            flex: 2,
            render: (item) => item.assetType?.name || 'N/A',
        },
        {
            field: 'unit_of_measure',
            header: 'Од.вим.',
            width: '80px',
            render: (item) => item.assetType?.unit_of_measure || '-',
            align: 'center',
        },
        { field: 'quantity', header: 'К-сть', width: '70px', align: 'right'},
        { field: 'unit_cost', header: 'Вартість', width: '100px', align: 'right' },
        {
            field: 'purchase_date',
            header: 'Дата придб.',
            width: '110px',
             // Форматування дати відбувається всередині DataRow
            align: 'center',
        },
        { field: 'notes', header: 'Примітки', flex: 3 }, // Найбільше місця для приміток
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
                borderColor: 'primary.main', // Виділяємо заголовок
                backgroundColor: 'action.hover', // Легкий фон
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
                <Paper sx={{ mt: 2, overflow: 'hidden' }}> {/* Додаємо Paper та overflow */}
                    {renderHeader(employeeColumnsConfig)}
                    <Box sx={{ maxHeight: '65vh', overflowY: 'auto' }}> {/* Обмежуємо висоту і додаємо скрол */}
                        {employeesData.map(employee => (
                            <DataRow key={employee.id} item={employee} columns={employeeColumnsConfig} />
                        ))}
                    </Box>
                </Paper>
            );
        } else { // Вкладка Активи
            if (assetsLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}><CircularProgress /></Box>;
            if (assetsError) return <Alert severity="error" sx={{ mt: 2 }}>Помилка завантаження списаних активів: {assetsError.message}</Alert>;
            if (!assetsData || assetsData.length === 0) return <Typography sx={{ mt: 2 }}>Списані активи відсутні.</Typography>;

            return (
                <Paper sx={{ mt: 2, overflow: 'hidden' }}>
                     {renderHeader(assetColumnsConfig)}
                     <Box sx={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {assetsData.map(asset => (
                            <DataRow key={asset.id} item={asset} columns={assetColumnsConfig} />
                        ))}
                    </Box>
                </Paper>
            );
        }
    };

    // --- Основний рендер сторінки (без змін у структурі вкладок) ---
    return (
        // <Layout>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom component="h1">
                Архів
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="Вкладки архіву">
                    <Tab label="Деактивовані співробітники" id="archive-tab-0" aria-controls="archive-tabpanel-0" />
                    <Tab label="Списані активи" id="archive-tab-1" aria-controls="archive-tabpanel-1" />
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
        // </Layout>
    );
};

export default ArchivePage;