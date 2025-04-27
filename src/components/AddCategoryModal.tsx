// components/AddCategoryModal.tsx
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

// --- Types ---
// Тип для форми
type CategoryAddFormShape = {
  name: string;
};

// Тип відповіді API
type CategoryApiResponse = {
    id: number;
    name: string;
    // ... інші поля, якщо API їх повертає
};

// Пропси компонента
interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (newCategory: CategoryApiResponse) => void; // Колбек при успіху
}

// --- Схема валідації ---
const validationSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Назва категорії є обов'язковою")
    .min(2, 'Назва має містити принаймні 2 символи'),
});

// --- Компонент Модального Вікна ---
export default function AddCategoryModal({
  open,
  onClose,
  onSubmitSuccess,
}: AddCategoryModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryAddFormShape>({
    resolver: yupResolver(validationSchema),
    defaultValues: { name: '' },
  });

  // --- Ефект для скидання форми ---
  React.useEffect(() => {
    if (!open) {
      reset({ name: '' }); // Скидаємо при закритті
      setSubmitError(null);
    } else {
        setSubmitError(null); // Скидаємо помилку при відкритті
    }
  }, [open, reset]);

  // --- Обробник відправки ---
  const onSubmit: SubmitHandler<CategoryAddFormShape> = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/asset-categories`, { // POST запит
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }), // Надсилаємо тільки name
      });

      const result = await response.json();
      if (!response.ok) {
        // Використовуємо повідомлення про помилку з API
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      onSubmitSuccess(result as CategoryApiResponse); // Передаємо створену категорію
      onClose(); // Закриваємо модал

    } catch (error) {
      console.error('Failed to add category:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Обробник закриття ---
  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Додати Нову Категорію</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>
          )}

          {/* Поле Назва Категорії */}
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="dense"
                label="Назва Категорії"
                type="text"
                fullWidth
                variant="outlined"
                required
                autoFocus
                error={!!errors.name}
                helperText={errors.name?.message}
                disabled={isSubmitting}
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit">
            Скасувати
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Додати Категорію'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
