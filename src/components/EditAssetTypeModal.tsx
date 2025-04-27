// components/EditAssetTypeModal.tsx
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

// Тип даних для форми редагування (співпадає з формою додавання)
type AssetTypeEditFormShape = {
  name: string;
  categoryId: string; // Використовуємо string для Select
  minimum_stock_level: number | null;
  notes: string | null;
};

// Тип даних, що передається в компонент (з таблиці)
type AssetTypeData = {
    id: number;
    name: string;
    categoryId: number;
    minimum_stock_level: number | null;
    notes: string | null;
    // Можуть бути інші поля, але вони не редагуються тут
};

// Тип відповіді API після оновлення
type AssetTypeApiResponse = {
    id: number; name: string; categoryId: number;
    minimum_stock_level: number | null; notes: string | null;
    // ... інші поля
};

// Пропси компонента
interface EditAssetTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (updatedAssetType: AssetTypeApiResponse) => void;
  assetType: AssetTypeData | null; // Дані типу для редагування
  categories: AssetCategoryOption[] | undefined;
  categoriesError: any;
}

// --- Validation Schema (така ж, як для додавання) ---
const validationSchema = yup.object({
  name: yup.string().trim().required("Назва типу є обов'язковою").min(2, 'Назва має містити принаймні 2 символи'),
  categoryId: yup.string().required("Категорія є обов'язковою"), // Валідуємо як рядок
  minimum_stock_level: yup.number()
    .transform((value, originalValue) => String(originalValue).trim() === "" || isNaN(value) ? null : value)
    .nullable().min(0).integer().default(null),
  notes: yup.string().nullable().default(null),
});

// --- Edit Asset Type Modal Component ---
export default function EditAssetTypeModal({
  open,
  onClose,
  onSubmitSuccess,
  assetType, // Дані для редагування
  categories,
  categoriesError,
}: EditAssetTypeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssetTypeEditFormShape>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      minimum_stock_level: null,
      notes: null,
    },
  });

  // --- Effect to populate form when assetType or open state changes ---
  React.useEffect(() => {
    if (assetType && open) {
      reset({
        name: assetType.name || '',
        categoryId: assetType.categoryId?.toString() || '',
        minimum_stock_level: assetType.minimum_stock_level,
        notes: assetType.notes || null,
      });
      setSubmitError(null);
    } else if (!open) {
        reset({ name: '', categoryId: '', minimum_stock_level: null, notes: null });
        setSubmitError(null);
    }
  }, [assetType, open, reset]);

  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<AssetTypeEditFormShape> = async (data) => {
    if (!assetType) return;
     if (!data.categoryId) {
         setSubmitError("Будь ласка, виберіть категорію.");
         return;
     }

    setIsSubmitting(true);
    setSubmitError(null);

    const categoryIdAsNumber = parseInt(data.categoryId, 10);
     if (isNaN(categoryIdAsNumber)) {
         setSubmitError("Некоректне значення категорії.");
         setIsSubmitting(false);
         return;
     }

    // *** ВИПРАВЛЕННЯ: Спрощене визначення payload ***
    // Явно визначаємо об'єкт з потрібними полями та типами
    const payload = {
        name: data.name,
        categoryId: categoryIdAsNumber, // Використовуємо перетворене число
        minimum_stock_level: data.minimum_stock_level,
        notes: data.notes || null,
    };
    // Перевірка типів (опціонально, для ясності)
    // const typedPayload: { name: string; categoryId: number; minimum_stock_level: number | null; notes: string | null } = payload;


    try {
      const response = await fetch(`/api/asset-types/${assetType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Надсилаємо спрощений payload
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      onSubmitSuccess(result as AssetTypeApiResponse);
      onClose();

    } catch (error) {
      console.error('Failed to update asset type:', error);
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
      <DialogTitle>Редагувати Тип Активу: {assetType?.name || ''}</DialogTitle>
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
                <InputLabel id="edit-asset-type-category-label">Категорія</InputLabel>
                <Select
                  {...field}
                  labelId="edit-asset-type-category-label"
                  label="Категорія"
                  // value є string
                >
                  <MenuItem value="" disabled><em>-- Оберіть категорію --</em></MenuItem>
                   {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка завантаження</MenuItem>}
                   {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20} sx={{mx: 'auto', display: 'block'}}/></MenuItem>}
                  {categories?.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id.toString()}> {/* value - рядок */}
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
          <Button type="submit" variant="contained" disabled={isSubmitting}> {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Зберегти Зміни'} </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
