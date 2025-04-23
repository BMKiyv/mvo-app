// components/AddAssetTypeModal.tsx
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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';

// --- Types ---
type AssetCategoryOption = {
  id: number;
  name: string;
};

// Форма: categoryId може бути null спочатку
type AssetTypeAddFormShape = {
  name: string;
  categoryId: number | null;
  minimum_stock_level: number | null;
  notes: string | null;
};

type AssetTypeApiResponse = {
    id: number; name: string; categoryId: number;
    minimum_stock_level: number | null; notes: string | null;
    // ... інші поля з API
};

interface AddAssetTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (newAssetType: AssetTypeApiResponse) => void;
  categories: AssetCategoryOption[] | undefined;
  categoriesError: any;
}

// --- Validation Schema ---
// Визначаємо схему без явної вказівки типу тут
const validationSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Назва типу є обов'язковою")
    .min(2, 'Назва має містити принаймні 2 символи'),
  categoryId: yup
    .number()
    .nullable() // Дозволяємо null
    .required("Категорія є обов'язковою") // Поле обов'язкове (не може бути null після вибору)
    .typeError("Необхідно вибрати категорію"), // Повідомлення, якщо не номер або null
  minimum_stock_level: yup
    .number()
    .transform((value, originalValue) =>
        String(originalValue).trim() === "" || isNaN(value) ? null : value
    )
    .nullable()
    .min(0, 'Мінімальний залишок не може бути від\'ємним')
    .integer('Мінімальний залишок має бути цілим числом')
    .default(null), // Встановлюємо null як default
  notes: yup.string().nullable().default(null),
});


// --- Add Asset Type Modal Component ---
export default function AddAssetTypeModal({
  open,
  onClose,
  onSubmitSuccess,
  categories,
  categoriesError,
}: AddAssetTypeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetTypeAddFormShape>({
    // *** ЯВНО ВКАЗУЄМО ТИП ДЛЯ RESOLVER ***
    resolver: yupResolver(validationSchema as yup.ObjectSchema<AssetTypeAddFormShape>),
    defaultValues: {
      name: '',
      categoryId: null, // Починаємо з null
      minimum_stock_level: null,
      notes: null,
    },
  });

  // --- Effect to reset form ---
  React.useEffect(() => {
    if (!open) {
      reset({ name: '', categoryId: null, minimum_stock_level: null, notes: null });
      setSubmitError(null);
    } else {
      setSubmitError(null);
    }
  }, [open, reset]);

  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<AssetTypeAddFormShape> = async (data) => {
     if (data.categoryId === null) {
         setSubmitError("Будь ласка, виберіть категорію.");
         return;
     }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
        name: data.name,
        categoryId: data.categoryId,
        minimum_stock_level: data.minimum_stock_level,
        notes: data.notes || null,
    };

    try {
      const response = await fetch(`/api/asset-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
      onSubmitSuccess(result as AssetTypeApiResponse);
      onClose();
    } catch (error) {
      console.error('Failed to add asset type:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Close Handler ---
  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Додати Новий Тип Активу</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && ( <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert> )}

          {/* Name Field */}
          <Controller name="name" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="Назва Типу Активу" type="text" fullWidth variant="outlined" required autoFocus error={!!errors.name} helperText={errors.name?.message} disabled={isSubmitting} /> )} />

          {/* Category Select */}
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth margin="dense" required error={!!errors.categoryId || !!categoriesError} disabled={isSubmitting}>
                <InputLabel id="add-asset-type-category-label">Категорія</InputLabel>
                <Select
                  {...field}
                  labelId="add-asset-type-category-label"
                  label="Категорія"
                  value={field.value === null ? '' : field.value} // Display '' for null
                  onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))} // Convert back
                >
                  <MenuItem value="" disabled><em>-- Оберіть категорію --</em></MenuItem>
                   {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка завантаження</MenuItem>}
                   {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20} sx={{mx: 'auto', display: 'block'}}/></MenuItem>}
                  {categories?.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}> {/* Value is number */}
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.categoryId && <FormHelperText>{errors.categoryId.message}</FormHelperText>}
                {categoriesError && <FormHelperText error>Не вдалося завантажити категорії.</FormHelperText>}
              </FormControl>
            )}
          />

          {/* Minimum Stock Level Field */}
          <Controller
            name="minimum_stock_level"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                 onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^[0-9]+$/.test(value)) {
                        field.onChange(value === '' ? null : Number(value));
                    }
                }}
                margin="dense" label="Мінімальний Залишок (шт.)" type="number"
                fullWidth variant="outlined"
                error={!!errors.minimum_stock_level}
                helperText={errors.minimum_stock_level?.message}
                disabled={isSubmitting}
                InputProps={{ inputProps: { min: 0 } }}
              />
            )}
          />

          {/* Notes Field */}
           <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} margin="dense" label="Примітки" type="text" fullWidth multiline rows={3} variant="outlined" error={!!errors.notes} helperText={errors.notes?.message} disabled={isSubmitting} />
            )}
          />

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit"> Скасувати </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}> {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Додати Тип Активу'} </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
