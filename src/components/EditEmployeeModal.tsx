// components/EditEmployeeModal.tsx
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
// Removed Checkbox imports

// --- Тип даних, що повертає API / передається в компонент ---
type EmployeeApiResponse = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
}

// --- Тип даних САМЕ для форми (без ID) ---
type EmployeeFormShape = {
  full_name: string;
  position: string | null;
  contact_info: string | null;
};


// --- Тип пропсів компонента ---
interface EditEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  employee: EmployeeApiResponse | null; // Дані співробітника для редагування
  onSubmitSuccess: (updatedEmployee: EmployeeApiResponse) => void; // Колбек при успішному оновленні
}

// --- ОНОВЛЕНА Схема валідації Yup ---
const validationSchema = yup.object({
  full_name: yup
    .string()
    .trim()
    .required("ПІБ є обов'язковим")
    .min(3, 'ПІБ має містити принаймні 3 символи'),
  position: yup
    .string()
    .nullable() // Дозволяє null
    .default(null), // <--- Встановлюємо null як default, щоб уникнути undefined
  contact_info: yup
    .string()
    .nullable() // Дозволяє null
    .email('Невірний формат email')
    .test('is-valid-email-or-empty', 'Невірний формат email', (value) => !value || yup.string().email().isValidSync(value))
    .default(null), // <--- Встановлюємо null як default
});

// --- Компонент Модального Вікна ---
export default function EditEmployeeModal({
  open,
  onClose,
  employee,
  onSubmitSuccess,
}: EditEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form (використовуємо EmployeeFormShape) ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    // Додаємо watch, якщо потрібно відстежувати значення
    // watch
  } = useForm<EmployeeFormShape>({
    resolver: yupResolver(validationSchema), // Тепер типи мають збігатися краще
    defaultValues: { // Встановлюємо початкові значення як null або ''
      full_name: '',
      position: null, // Використовуємо null за замовчуванням
      contact_info: null, // Використовуємо null за замовчуванням
    },
  });

  // --- Ефект для оновлення форми при зміні співробітника ---
  React.useEffect(() => {
    if (employee && open) {
      reset({
        full_name: employee.full_name || '',
        // Переконуємося, що передаємо null, якщо значення порожнє або null
        position: employee.position ?? null,
        contact_info: employee.contact_info ?? null,
      });
      setSubmitError(null);
    } else if (!open) {
        // Скидаємо до значень за замовчуванням при закритті
        reset({ full_name: '', position: null, contact_info: null });
        setSubmitError(null);
    }
  }, [employee, open, reset]); // Додаємо reset до залежностей, як рекомендує react-hook-form


  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<EmployeeFormShape> = async (data) => {
    if (!employee) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Переконуємося, що порожні строки надсилаються як null, якщо потрібно
    const updatePayload = {
        full_name: data.full_name,
        position: data.position || null, // Надсилаємо null, якщо поле порожнє
        contact_info: data.contact_info || null, // Надсилаємо null, якщо поле порожнє
    };


    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      onSubmitSuccess(result as EmployeeApiResponse);
      onClose();

    } catch (error) {
      console.error('Failed to update employee:', error);
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
      <DialogTitle>Редагувати Співробітника</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* Full Name Field */}
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

          {/* Position Field */}
          <Controller
            name="position"
            control={control}
            render={({ field }) => (
              <TextField
                {...field} value={field.value ?? ''} // Відображаємо '' замість null у полі
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

          {/* Contact Info Field */}
          <Controller
            name="contact_info"
            control={control}
            render={({ field }) => (
              <TextField
                {...field} value={field.value ?? ''} // Відображаємо '' замість null у полі
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
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Зберегти Зміни'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
