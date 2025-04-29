// components/EditEmployeeModal.tsx
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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography'; // Імпортуємо Typography

// --- Тип даних, що повертає API / передається в компонент ---
// Включає ВСІ поля, які ми можемо отримати для співробітника
type EmployeeApiResponse = {
    id: number;
    full_name: string;
    position: string | null;
    contact_info: string | null;
    is_active: boolean;
    is_responsible: boolean;
    commission_role: CommissionRole;
    is_head_of_enterprise: boolean;
    is_chief_accountant: boolean;
    // created_at?: Date; // Може бути, якщо GET API його повертає
}

// --- Тип даних САМЕ для форми редагування ---
// Включає всі поля, які можна редагувати
type EmployeeEditFormShape = {
  full_name: string;
  position: string | null;
  contact_info: string | null;
  commission_role: CommissionRole;
  is_head_of_enterprise: boolean;
  is_chief_accountant: boolean;
  // is_responsible: boolean; // Додайте, якщо потрібно редагувати
};


// --- Тип пропсів компонента ---
interface EditEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  employee: EmployeeApiResponse | null; // Дані співробітника для редагування
  // Колбек повертає оновлені дані з API
  onSubmitSuccess: (updatedEmployee: EmployeeApiResponse) => void;
}

// --- Опції для вибору ролі в комісії ---
const commissionRoleOptions: { value: CommissionRole; label: string }[] = [
    { value: CommissionRole.none, label: 'Не в комісії' },
    { value: CommissionRole.member, label: 'Член комісії' },
    { value: CommissionRole.chair, label: 'Голова комісії' },
];


// --- Схема валідації Yup (з усіма полями для редагування) ---
const validationSchema = yup.object({
  full_name: yup.string().trim().required("ПІБ є обов'язковим").min(3, 'ПІБ має містити принаймні 3 символи'),
  position: yup.string().nullable().default(null),
  contact_info: yup.string().nullable().email('Невірний формат email').test('is-valid-email-or-empty', 'Невірний формат email', (value) => !value || yup.string().email().isValidSync(value)).default(null),
  commission_role: yup.mixed<CommissionRole>().oneOf(Object.values(CommissionRole), 'Некоректна роль в комісії').required("Роль в комісії є обов'язковою"),
  is_head_of_enterprise: yup.boolean().required(),
  is_chief_accountant: yup.boolean().required(),
  // is_responsible: yup.boolean().required(),
});

// --- Компонент Модального Вікна Редагування ---
export default function EditEmployeeModal({
  open,
  onClose,
  employee, // Поточні дані співробітника
  onSubmitSuccess,
}: EditEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // --- React Hook Form (з усіма полями) ---
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeEditFormShape>({
    resolver: yupResolver(validationSchema),
    // defaultValues будуть встановлені в useEffect
  });

  // --- Ефект для заповнення/скидання форми ---
  React.useEffect(() => {
    if (employee && open) {
      // Заповнюємо форму поточними даними співробітника
      reset({
        full_name: employee.full_name || '',
        position: employee.position || null,
        contact_info: employee.contact_info || null,
        commission_role: employee.commission_role || CommissionRole.none,
        is_head_of_enterprise: employee.is_head_of_enterprise || false,
        is_chief_accountant: employee.is_chief_accountant || false,
        // is_responsible: employee.is_responsible || false,
      });
      setSubmitError(null);
    } else if (!open) {
      // Скидаємо форму при закритті
      reset({
          full_name: '', position: null, contact_info: null,
          commission_role: CommissionRole.none,
          is_head_of_enterprise: false, is_chief_accountant: false
      });
      setSubmitError(null);
    }
  }, [employee, open, reset]); // Залежимо від employee та open

  // --- Form Submission Handler (з усіма полями) ---
  const onSubmit: SubmitHandler<EmployeeEditFormShape> = async (data) => {
    if (!employee) return; // Перевірка

    setIsSubmitting(true);
    setSubmitError(null);

    // Формуємо payload з усіма полями форми
    const payload = {
        full_name: data.full_name,
        position: data.position || null,
        contact_info: data.contact_info || null,
        commission_role: data.commission_role,
        is_head_of_enterprise: data.is_head_of_enterprise,
        is_chief_accountant: data.is_chief_accountant,
        // is_responsible: data.is_responsible,
    };
    console.log("Submitting Employee Update Data:", payload);

    try {
      // Відправляємо PUT запит на ендпоінт конкретного співробітника
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try { errorMsg = result.message || errorMsg; } catch (e) {}
          throw new Error(errorMsg);
      }

      // Викликаємо колбек з оновленими даними з API
      onSubmitSuccess(result as EmployeeApiResponse);
      onClose(); // Закриваємо модал

    } catch (error) {
      console.error('Failed to update employee:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Close Handler ---
  const handleClose = () => { if (isSubmitting) return; onClose(); };


  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Редагувати Співробітника: {employee?.full_name || ''}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {submitError && ( <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert> )}

          {/* Основні дані */}
          <Controller name="full_name" control={control} render={({ field }) => ( <TextField {...field} margin="dense" label="ПІБ" type="text" fullWidth variant="outlined" required error={!!errors.full_name} helperText={errors.full_name?.message} disabled={isSubmitting} autoFocus /> )} />
          <Controller name="position" control={control} render={({ field }) => ( <TextField {...field} value={field.value ?? ''} margin="dense" label="Посада" type="text" fullWidth variant="outlined" error={!!errors.position} helperText={errors.position?.message} disabled={isSubmitting} /> )} />
          <Controller name="contact_info" control={control} render={({ field }) => ( <TextField {...field} value={field.value ?? ''} margin="dense" label="Контактна інформація (Email)" type="email" fullWidth variant="outlined" error={!!errors.contact_info} helperText={errors.contact_info?.message} disabled={isSubmitting} /> )} />

          <Divider sx={{ my: 2 }} />

          {/* Ролі */}
          <Typography variant="subtitle1" gutterBottom>Ролі Співробітника</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Роль в Комісії */}
                <Controller
                    name="commission_role"
                    control={control}
                    render={({ field }) => (
                        <FormControl fullWidth margin="dense" required error={!!errors.commission_role} disabled={isSubmitting}>
                            <InputLabel id="edit-commission-role-select-label">Роль в Комісії Списання</InputLabel>
                            <Select {...field} labelId="edit-commission-role-select-label" label="Роль в Комісії Списання">
                                {commissionRoleOptions.map((option) => ( <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem> ))}
                            </Select>
                            {errors.commission_role && <FormHelperText>{errors.commission_role.message}</FormHelperText>}
                        </FormControl>
                    )}
                />

                {/* Прапорці для інших ролей */}
                <FormGroup>
                    {/* Голова підприємства */}
                    <Controller
                        name="is_head_of_enterprise"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox {...field} checked={field.value} disabled={isSubmitting} />}
                                label="Голова Підприємства (для підпису актів)"
                            />
                        )}
                    />
                    {/* Головний бухгалтер */}
                     <Controller
                        name="is_chief_accountant"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox {...field} checked={field.value} disabled={isSubmitting} />}
                                label="Головний Бухгалтер (для підпису актів)"
                            />
                        )}
                    />
                     {/* Відповідальна особа (розкоментуйте, якщо потрібно редагувати) */}
                     {/*
                     <Controller
                        name="is_responsible"
                        control={control}
                        render={({ field }) => (
                            <FormControlLabel
                                control={<Checkbox {...field} checked={field.value} disabled={isSubmitting} />}
                                label="Матеріально-відповідальна особа"
                            />
                        )}
                    />
                    */}
                </FormGroup>
          </Box>

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit"> Скасувати </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}> {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Зберегти Зміни'} </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
