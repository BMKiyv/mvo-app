// components/AddEmployeeModal.tsx
'use client';

import * as React from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
// Імпортуємо Enum CommissionRole
import { CommissionRole } from '@prisma/client';

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
import FormControl from '@mui/material/FormControl'; // <--- Додано
import InputLabel from '@mui/material/InputLabel'; // <--- Додано
import Select from '@mui/material/Select';       // <--- Додано
import MenuItem from '@mui/material/MenuItem';     // <--- Додано
import FormHelperText from '@mui/material/FormHelperText'; // <--- Додано

// --- Тип даних для форми додавання (з commission_role) ---
type EmployeeAddFormShape = {
  full_name: string;
  position: string | null;
  contact_info: string | null;
  commission_role: CommissionRole; // Додано поле, тип - Enum
};

// --- Тип даних, що повертає API після успішного створення ---
// Оновлюємо для включення commission_role
type EmployeeApiResponse = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
    commission_role: CommissionRole; // Додано поле
}

// --- Тип пропсів компонента ---
interface AddEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: (newEmployee: EmployeeApiResponse) => void;
}

// --- Опції для вибору ролі ---
const commissionRoleOptions: { value: CommissionRole; label: string }[] = [
    { value: CommissionRole.none, label: 'Не в комісії' },
    { value: CommissionRole.member, label: 'Член комісії' },
    { value: CommissionRole.chair, label: 'Голова комісії' },
];


// --- Схема валідації Yup (з commission_role) ---
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
  commission_role: yup // Додано валідацію для ролі
    .mixed<CommissionRole>() // Вказуємо тип Enum
    .oneOf(Object.values(CommissionRole), 'Некоректна роль в комісії') // Перевіряємо, чи значення є в Enum
    .required("Роль в комісії є обов'язковою"), // Робимо поле обов'язковим
});

// --- Компонент Модального Вікна Додавання ---
export default function AddEmployeeModal({
  open,
  onClose,
  onSubmitSuccess,
}: AddEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form (з commission_role) ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeAddFormShape>({
    resolver: yupResolver(validationSchema),
    defaultValues: { // Додаємо значення за замовчуванням
      full_name: '',
      position: null,
      contact_info: null,
      commission_role: CommissionRole.none, // За замовчуванням - не в комісії
    },
  });

  // --- Ефект для скидання форми ---
  React.useEffect(() => {
    if (!open) {
      // Скидаємо всі поля
      reset({ full_name: '', position: null, contact_info: null, commission_role: CommissionRole.none });
      setSubmitError(null);
    } else {
        setSubmitError(null);
    }
  }, [open, reset]);

  // --- Form Submission Handler (з commission_role) ---
  const onSubmit: SubmitHandler<EmployeeAddFormShape> = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Формуємо payload з усіма полями
    const payload = {
        full_name: data.full_name,
        position: data.position || null,
        contact_info: data.contact_info || null,
        commission_role: data.commission_role, // Додаємо роль
    };
    console.log("Submitting Employee Data:", payload);


    try {
      const response = await fetch(`/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try { errorMsg = result.message || errorMsg; } catch (e) {}
          throw new Error(errorMsg);
      }

      if (Array.isArray(result) && result.length > 0 && result[0]) {
           onSubmitSuccess(result[0] as EmployeeApiResponse);
           onClose();
      } else {
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
            <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>
          )}

          {/* Поле ПІБ */}
          <Controller name="full_name" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="ПІБ" type="text" fullWidth variant="outlined" required error={!!errors.full_name} helperText={errors.full_name?.message} disabled={isSubmitting} autoFocus /> )} />

          {/* Поле Посада */}
          <Controller name="position" control={control} render={({ field }) => ( <TextField {...field} value={field.value ?? ''} margin="dense" label="Посада" type="text" fullWidth variant="outlined" error={!!errors.position} helperText={errors.position?.message} disabled={isSubmitting} /> )} />

          {/* Поле Контактна інформація */}
          <Controller name="contact_info" control={control} render={({ field }) => ( <TextField {...field} value={field.value ?? ''} margin="dense" label="Контактна інформація (Email)" type="email" fullWidth variant="outlined" error={!!errors.contact_info} helperText={errors.contact_info?.message} disabled={isSubmitting} /> )} />

          {/* --- Поле Роль в Комісії (НОВЕ) --- */}
           <Controller
                name="commission_role"
                control={control}
                render={({ field }) => (
                    <FormControl fullWidth margin="dense" required error={!!errors.commission_role} disabled={isSubmitting}>
                        <InputLabel id="commission-role-select-label">Роль в Комісії Списання</InputLabel>
                        <Select
                            {...field}
                            labelId="commission-role-select-label"
                            label="Роль в Комісії Списання"
                            // value вже має тип CommissionRole
                        >
                            {/* Немає опції "не вибрано", бо поле обов'язкове */}
                            {commissionRoleOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.commission_role && <FormHelperText>{errors.commission_role.message}</FormHelperText>}
                    </FormControl>
                )}
            />


        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit"> Скасувати </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}> {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Додати Співробітника'} </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
