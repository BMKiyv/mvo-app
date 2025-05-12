// src/components/AssetImportModal.tsx
import React, { useState, useCallback, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
    Link, Alert, LinearProgress, Input // Використаємо Input для прихованого file input
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

// Імпортуємо тип рядка з API (або визначаємо його тут/в спільному файлі)
interface AssetImportRow {
    rowIndex: number;
    assetTypeName: string | null | undefined;
    categoryName: string | null | undefined;
    unitOfMeasure: string | null | undefined;
    minimumStockLevel?: number | string | null | undefined;
    inventoryNumber: string | null | undefined;
    quantity: number | string | null | undefined;
    unitCost: number | string | null | undefined;
    purchaseDate: string | Date | null | undefined;
    instanceNotes?: string | null | undefined;
}

interface AssetImportModalProps {
    open: boolean;
    onClose: () => void;
    onImportSuccess: (count: number) => void; // Callback при успішному імпорті
}

// Очікувані заголовки в Excel файлі (для мапінгу)
const EXPECTED_HEADERS = {
    assetTypeName: 'НазваТипу',
    categoryName: 'Категорія',
    unitOfMeasure: 'ОдВимірювання',
    minimumStockLevel: 'МінЗалишок',
    inventoryNumber: 'ІнвентарнийНомер',
    quantity: 'Кількість',
    unitCost: 'ЦінаЗаОдиницю',
    purchaseDate: 'ДатаПридбання',
    instanceNotes: 'ПриміткиЕкземпляра',
};

// Функція для мапінгу та базової валідації даних з Excel
// Повертає або масив даних, або рядок з помилкою
function mapRawDataToDto(rawData: any[]): AssetImportRow[] | string {
    if (!rawData || rawData.length === 0) {
        return "Файл порожній або не вдалося прочитати дані.";
    }

    const mappedData: AssetImportRow[] = [];
    const headerRow = rawData[0]; // Припускаємо, що перший рядок - заголовки

    // Проста перевірка наявності хоча б основних заголовків (можна зробити детальніше)
    const requiredHeaders = [
        EXPECTED_HEADERS.assetTypeName,
        EXPECTED_HEADERS.inventoryNumber,
        EXPECTED_HEADERS.quantity,
        EXPECTED_HEADERS.unitCost,
        EXPECTED_HEADERS.purchaseDate,
    ];
    const actualHeaders = Object.values(headerRow); // Отримуємо значення заголовків з першого рядка
    for (const reqHeader of requiredHeaders) {
        // Перевіряємо, чи присутній кожен обов'язковий заголовок
        // Змінено: XLSX може повертати об'єкт, де ключі це літери стовпців, а значення - вміст комірки
        // Краще використовувати sheet_to_json з опцією header: 1 для масиву масивів
        // Або sheet_to_json без опцій, тоді ключами будуть самі заголовки
        // Припустимо, sheet_to_json без опцій (повертає масив об'єктів з ключами-заголовками)
         if (!rawData.some(row => Object.keys(row).includes(reqHeader))) {
              // Якщо sheet_to_json повернув об'єкти з ключами заголовків
             if (!Object.keys(rawData[0] ?? {}).includes(reqHeader)) {
                 return `Помилка структури файлу: Відсутній обов'язковий стовпчик "${reqHeader}". Перевірте шаблон.`;
            }
         }
    }


    // Ітеруємо по рядках даних (починаючи з другого рядка Excel, якщо перший - заголовки)
    // Якщо sheet_to_json без опцій, він вже повертає дані без заголовків
    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowIndex = i + 2; // +2 бо індекс з 0 і перший рядок - заголовки

        // Створюємо об'єкт DTO, беручи значення за очікуваними заголовками
        const mappedRow: AssetImportRow = {
            rowIndex: rowIndex,
            assetTypeName: row[EXPECTED_HEADERS.assetTypeName] ?? null,
            categoryName: row[EXPECTED_HEADERS.categoryName] ?? null,
            unitOfMeasure: row[EXPECTED_HEADERS.unitOfMeasure] ?? null,
            minimumStockLevel: row[EXPECTED_HEADERS.minimumStockLevel] ?? null,
            inventoryNumber: row[EXPECTED_HEADERS.inventoryNumber] ?? null,
            quantity: row[EXPECTED_HEADERS.quantity] ?? null,
            unitCost: row[EXPECTED_HEADERS.unitCost] ?? null,
            purchaseDate: row[EXPECTED_HEADERS.purchaseDate] ?? null, // Дати можуть бути вже об'єктами Date якщо cellDates: true
            instanceNotes: row[EXPECTED_HEADERS.instanceNotes] ?? null,
        };

        // Тут можна додати ще базову фронтенд валідацію типів, якщо потрібно,
        // але основна валідація буде на бекенді.
        // Наприклад, перевірити чи quantity/unitCost схожі на числа, дата на дату і т.д.

        mappedData.push(mappedRow);
    }

    return mappedData;
}


const AssetImportModal: React.FC<AssetImportModalProps> = ({ open, onClose, onImportSuccess }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setSuccessMessage(null);
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            // Перевірка типу файлу
            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
                 setSelectedFile(file);
            } else {
                 setError('Неправильний тип файлу. Будь ласка, виберіть файл .xlsx або .xls');
                 setSelectedFile(null);
            }
        } else {
             setSelectedFile(null);
        }
    };

    const handleImportClick = useCallback(() => {
        if (!selectedFile) {
            setError('Будь ласка, виберіть файл для імпорту.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const binaryStr = event.target?.result;
                 // Важливо: cellDates: true спробує автоматично розпізнати дати
                const workbook = XLSX.read(binaryStr, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // Використовуємо sheet_to_json без опцій, очікуючи об'єкти з ключами-заголовками
                const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

                // Мапінг та базова валідація структури
                const mappedResult = mapRawDataToDto(rawData);

                if (typeof mappedResult === 'string') {
                    // Якщо мапінг повернув помилку
                    throw new Error(mappedResult);
                }

                // Відправляємо дані на бекенд
                const response = await fetch('/api/inventory/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedResult), // Відправляємо оброблений масив
                });

                const result = await response.json();

                if (!response.ok) {
                    // Формуємо повідомлення про помилку від бекенду
                     let backendError = result.message || `Помилка імпорту (HTTP ${response.status})`;
                     if (result.rowIndex) {
                         backendError += ` (Рядок Excel: ${result.rowIndex}${result.fieldName ? `, Поле: ${result.fieldName}` : ''})`;
                     }
                    throw new Error(backendError);
                }

                // Успіх
                setSuccessMessage(result.message || 'Імпорт успішно завершено.');
                setSelectedFile(null); // Скидаємо файл
                onImportSuccess(result.importedCount || 0); // Викликаємо callback
                // onClose(); // Можна закрити модал автоматично при успіху

            } catch (err: any) {
                console.error("Import error:", err);
                setError(err.message || 'Невідома помилка під час обробки файлу або імпорту.');
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = (error) => {
             console.error("FileReader error:", error);
             setError('Не вдалося прочитати файл.');
             setIsLoading(false);
        }
        // Читаємо файл як бінарний рядок для XLSX
        reader.readAsBinaryString(selectedFile);

    }, [selectedFile, onImportSuccess]);

     // Скидання стану при закритті модалу
     const handleClose = () => {
        if (isLoading) return; // Не закривати під час завантаження
        setSelectedFile(null);
        setError(null);
        setSuccessMessage(null);
        onClose();
    };


    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Імпорт Активів з Excel</DialogTitle>
            <DialogContent dividers>
                <Box mb={2}>
                    <Typography variant="body2" gutterBottom>
                        Завантажте файл формату .xlsx або .xls зі списком активів для імпорту.
                        Структура файлу має відповідати шаблону.
                    </Typography>
                    <Link href="/templates/asset_import_template.xlsx" target="_blank" download>
                        Завантажити шаблон
                    </Link>
                     {/* TODO: Додати детальні інструкції щодо стовпчиків */}
                     <Typography variant="caption" display="block" mt={1}>
                         (Інструкції: Обов'язкові поля: НазваТипу, ІнвентарнийНомер, Кількість, ЦінаЗаОдиницю, ДатаПридбання.
                         Категорія та ОдВимірювання - обов'язкові тільки для нових типів. Формат дати: ДД.ММ.РРРР або РРРР-ММ-ДД. Імпорт зупиняється при першій помилці.)
                     </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                     {/* Кнопка для вибору файлу */}
                     <Button
                        component="label" // Дозволяє кнопці діяти як label для input
                        variant="outlined"
                        startIcon={<CloudUploadIcon />}
                        disabled={isLoading}
                    >
                        Вибрати файл
                         {/* Прихований input */}
                         <Input
                            type="file"
                            onChange={handleFileChange}
                            sx={{ display: 'none' }} // Приховуємо стандартний input
                            inputProps={{ accept: ".xlsx, .xls" }} // Приймаємо тільки Excel файли
                        />
                    </Button>
                    {selectedFile && (
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                             <InsertDriveFileIcon fontSize="small" color="action" />
                            <Typography variant="body2" noWrap title={selectedFile.name}>
                                {selectedFile.name}
                            </Typography>
                        </Box>
                    )}
                </Box>

                 {/* Індикатор завантаження */}
                 {isLoading && <LinearProgress sx={{ mb: 2 }} />}

                 {/* Повідомлення про помилку/успіх */}
                 {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                 {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isLoading}>Скасувати</Button>
                <Button
                    onClick={handleImportClick}
                    variant="contained"
                    disabled={!selectedFile || isLoading}
                >
                    {isLoading ? 'Імпортування...' : 'Імпортувати'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AssetImportModal;    