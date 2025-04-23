// components/AddEmployeeModal.tsx
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

// --- Тип даних для форми додавання ---
type EmployeeAddFormShape = {
  full_name: string;
  position: string | null;
  contact_info: string | null;
};

// --- Тип даних, що повертає API після успішного створення ---
type EmployeeApiResponse = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
}

// --- Тип пропсів компонента ---
interface AddEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (newEmployee: EmployeeApiResponse) => void;
}

// --- Схема валідації Yup ---
const validationSchema = yup.object({
  full_name: yup
    .string()
    .trim()
    .required("ПІБ є обов'язковим")
    .min(3, 'ПІБ має містити принаймні 3 символи'),
  position: yup
    .string()
    .nullable()
    .default(null),
  contact_info: yup
    .string()
    .nullable()
    .email('Невірний формат email')
    .test('is-valid-email-or-empty', 'Невірний формат email', (value) => !value || yup.string().email().isValidSync(value))
    .default(null),
});

// --- Компонент Модального Вікна Додавання ---
export default function AddEmployeeModal({
  open,
  onClose,
  onSubmitSuccess,
}: AddEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeAddFormShape>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      full_name: '',
      position: null,
      contact_info: null,
    },
  });

  // --- Ефект для скидання форми при закритті/відкритті ---
  React.useEffect(() => {
    if (!open) {
      reset({ full_name: '', position: null, contact_info: null });
      setSubmitError(null);
    } else {
         setSubmitError(null);
    }
  }, [open, reset]);

  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<EmployeeAddFormShape> = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
        full_name: data.full_name,
        position: data.position || null,
        contact_info: data.contact_info || null,
    };

    try {
      const response = await fetch(`/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Перевіряємо відповідь перед парсингом JSON
      if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
              const errorResult = await response.json();
              errorMsg = errorResult.message || errorMsg;
          } catch (jsonError) {
              // Якщо тіло відповіді не JSON або порожнє
              console.error("Failed to parse error response JSON:", jsonError);
          }
          throw new Error(errorMsg);
      }

      // Отримуємо результат (очікуємо масив з одним елементом)
      const result = await response.json();

      // *** ВИПРАВЛЕННЯ: Перевіряємо структуру відповіді та передаємо перший елемент ***
      if (Array.isArray(result) && result.length > 0 && result[0]) {
           // Передаємо перший елемент масиву в onSubmitSuccess
           onSubmitSuccess(result[0] as EmployeeApiResponse);
           onClose(); // Закриваємо модал при успіху
      } else {
          // Якщо відповідь не є масивом або порожня
          console.error("Unexpected API response format:", result);
          throw new Error("Не вдалося обробити відповідь сервера після створення співробітника.");
      }

    } catch (error) {
      console.error('Failed to add employee:', error);
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
      <DialogTitle>Додати Нового Співробітника</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* Поле ПІБ */}
          <Controller
            name="full_name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="dense"
                label="ПІБ"
                type="text"
                fullWidth
                variant="outlined"
                required
                error={!!errors.full_name}
                helperText={errors.full_name?.message}
                disabled={isSubmitting}
                autoFocus
              />
            )}
          />

          {/* Поле Посада */}
          <Controller
            name="position"
            control={control}
            render={({ field }) => (
              <TextField
                {...field} value={field.value ?? ''}
                margin="dense"
                label="Посада"
                type="text"
                fullWidth
                variant="outlined"
                error={!!errors.position}
                helperText={errors.position?.message}
                disabled={isSubmitting}
              />
            )}
          />

          {/* Поле Контактна інформація */}
          <Controller
            name="contact_info"
            control={control}
            render={({ field }) => (
              <TextField
                {...field} value={field.value ?? ''}
                margin="dense"
                label="Контактна інформація (Email)"
                type="email"
                fullWidth
                variant="outlined"
                error={!!errors.contact_info}
                helperText={errors.contact_info?.message}
                disabled={isSubmitting}
              />
            )}
          />

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit">
            Скасувати
          </Button>
          <Button
             type="submit"
             variant="contained"
             disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Додати Співробітника'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
