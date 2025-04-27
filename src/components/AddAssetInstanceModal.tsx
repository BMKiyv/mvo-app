// components/AddAssetInstanceModal.tsx
'use client';

import * as React from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

// MUI Components
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

// --- Types ---
type AssetTypeInfo = {
  id: number;
  name: string;
};

// Форма: notes тепер string | null
type AssetInstanceAddFormShape = {
  inventoryNumber: string;
  quantity: number;
  unit_cost: string; // Залишаємо string для поля вводу
  purchase_date: string;
  notes: string | null; // Змінено на string | null
};

type AssetInstanceApiResponse = {
    id: number;
    // ... інші поля
};

interface AddAssetInstanceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (newInstance: AssetInstanceApiResponse) => void;
  assetType: AssetTypeInfo | null;
}

// --- Validation Schema ---
const validationSchema = yup.object({
  inventoryNumber: yup
    .string()
    .trim()
    .required("Інвентарний номер є обов'язковим"),
  quantity: yup
    .number()
    .required("Кількість є обов'язковою")
    .min(1, 'Кількість має бути 1 або більше')
    .integer('Кількість має бути цілим числом')
    .typeError('Введіть дійсну кількість'),
  unit_cost: yup // Валідуємо як рядок
    .string()
    .required("Вартість за одиницю є обов'язковою")
    .test('is-valid-cost', 'Введіть дійсну вартість (число >= 0)', (value) => {
        if (value === undefined || value === null || value.trim() === '') return false;
        const processedValue = value.replace(',', '.');
        const num = Number(processedValue);
        return !isNaN(num) && isFinite(num) && num >= 0;
    }),
  purchase_date: yup
    .string()
    .required("Дата придбання є обов'язковою")
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Невірний формат дати (РРРР-ММ-ДД)')
    .test('is-valid-date', 'Введіть дійсну дату', (value) => {
        if (!value) return false;
        const date = new Date(value);
        return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
    }),
  notes: yup.string().nullable().default(null), // Використовуємо nullable() та default(null)
});


// --- Add Asset Instance Modal Component ---
export default function AddAssetInstanceModal({
  open,
  onClose,
  onSubmitSuccess,
  assetType,
}: AddAssetInstanceModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetInstanceAddFormShape>({
    resolver: yupResolver(validationSchema), // Схема тепер відповідає типу форми
    defaultValues: { // notes тепер null
      inventoryNumber: '',
      quantity: 1,
      unit_cost: '',
      purchase_date: '',
      notes: null, // Встановлюємо null за замовчуванням
    },
  });

  // --- Effect to reset form ---
  React.useEffect(() => {
    if (open) {
        const today = new Date().toISOString().split('T')[0];
        reset({
            inventoryNumber: '', quantity: 1, unit_cost: '',
            purchase_date: today, notes: null, // Скидаємо notes на null
        });
        setSubmitError(null);
    }
  }, [open, assetType, reset]);

  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<AssetInstanceAddFormShape> = async (data) => {
    if (!assetType) { setSubmitError("Тип активу не визначено."); return; }

    const unitCostAsNumber = Number(data.unit_cost.replace(',', '.'));
    if (isNaN(unitCostAsNumber) || unitCostAsNumber < 0) {
         setSubmitError("Некоректна вартість за одиницю.");
         return;
     }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
        assetTypeId: assetType.id,
        inventoryNumber: data.inventoryNumber,
        quantity: data.quantity,
        unit_cost: unitCostAsNumber,
        purchase_date: data.purchase_date,
        // Перетворюємо порожній рядок на null перед відправкою
        notes: data.notes?.trim() || null,
    };

    try {
      const response = await fetch(`/api/asset-instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) { throw new Error(result.message || `HTTP error! status: ${response.status}`); }
      onSubmitSuccess(result as AssetInstanceApiResponse);
      onClose();
    } catch (error) {
      console.error('Failed to add asset instance:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Close Handler ---
  const handleClose = () => { if (!isSubmitting) onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Додати Екземпляр/Партію: {assetType?.name || '...'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && ( <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert> )}

          {/* Layout using Box and Flexbox */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Inventory Number */}
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
              <Controller name="inventoryNumber" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="Інвентарний Номер / № Партії" type="text" fullWidth variant="outlined" required autoFocus error={!!errors.inventoryNumber} helperText={errors.inventoryNumber?.message} disabled={isSubmitting} /> )} />
            </Box>

            {/* Quantity */}
             <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
              <Controller name="quantity" control={control} render={({ field }) => ( <TextField {...field} value={field.value ?? 1} onChange={(e) => { const val = e.target.value; field.onChange(val === '' ? '' : parseInt(val, 10) || 1); }} onBlur={(e) => { if (Number(field.value) < 1) field.onChange(1); }} margin="dense" label="Кількість (шт.)" type="number" fullWidth variant="outlined" required error={!!errors.quantity} helperText={errors.quantity?.message} disabled={isSubmitting} InputProps={{ inputProps: { min: 1 } }} /> )} />
            </Box>

             {/* Unit Cost */}
             <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
              <Controller name="unit_cost" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="Вартість за одиницю (грн)" type="text" inputMode="decimal" fullWidth variant="outlined" required error={!!errors.unit_cost} helperText={errors.unit_cost?.message} disabled={isSubmitting} /> )} />
            </Box>

             {/* Purchase Date */}
             <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
              <Controller name="purchase_date" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="Дата Придбання" type="date" fullWidth variant="outlined" required error={!!errors.purchase_date} helperText={errors.purchase_date?.message} disabled={isSubmitting} InputLabelProps={{ shrink: true }} /> )} />
            </Box>

            {/* Notes */}
            <Box sx={{ width: '100%' }}>
               <Controller
                name="notes" // Тепер string | null
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''} // Показуємо '' для null
                    margin="dense" label="Примітки" type="text" fullWidth multiline rows={3} variant="outlined"
                    error={!!errors.notes} helperText={errors.notes?.message} disabled={isSubmitting}
                   />
                 )}
               />
            </Box>
          </Box> {/* End Flex container */}

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit"> Скасувати </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}> {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Додати Екземпляр'} </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
