// components/IssueAssetModal.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useForm, Controller, SubmitHandler } from 'react-hook-form'; // Using react-hook-form for potential future additions

// MUI Components
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Radio from '@mui/material/Radio'; // Use Radio buttons for selection
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel'; // Added for RadioGroup label
import FormHelperText from '@mui/material/FormHelperText'; // Added for potential errors
import Chip from '@mui/material/Chip';

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        return res.json().then(info => { (error as any).info = info; throw error; })
                         .catch(() => { throw error; });
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return res.json();
});

// --- Types ---
// Type for Asset Types dropdown
type AssetTypeOption = {
  id: number;
  name: string;
  // Add categoryName if needed for display
};

// Type for available instances list (matches API response)
type AvailableAssetData = {
  instanceId: number;
  inventoryNumber: string;
  quantity: number;
  unit_cost: string;
  purchase_date: string; // Keep as string for display simplicity
  notes: string | null;
};

// Type for the assigned instance data returned on success
type AssignedInstanceData = {
    id: number;
    assetTypeName?: string;
    inventoryNumber: string;
    // Add other fields if needed from the API response
};


// Type for form data (only the selected instance ID)
type IssueFormShape = {
    selectedInstanceId: string | null; // Store as string for RadioGroup value
};

// Props for the modal component
interface IssueAssetModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number | null; // ID of the employee receiving the asset
  employeeName: string; // Name for display in title
  onSubmitSuccess: (assignedAsset: AssignedInstanceData) => void; // Callback on success
}

// --- Issue Asset Modal Component ---
export default function IssueAssetModal({
  open,
  onClose,
  employeeId,
  employeeName,
  onSubmitSuccess,
}: IssueAssetModalProps) {
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState<string>(''); // Store type ID as string for Select
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Fetch Asset Types for dropdown ---
  const { data: assetTypes, error: assetTypesError } = useSWR<AssetTypeOption[]>('/api/asset-types', fetcher); // Assuming API returns {id, name}

  // --- Fetch Available Instances based on selected type ---
  const { data: availableInstances, error: instancesError, isLoading: isLoadingInstances } = useSWR<AvailableAssetData[]>(
    selectedAssetTypeId ? `/api/asset-instances/available?assetTypeId=${selectedAssetTypeId}` : null, // Fetch only when type is selected
    fetcher
  );

  // --- React Hook Form for selected instance ---
  const {
    control,
    handleSubmit,
    reset, // Function to reset form state
    formState: { errors: formErrors }, // Get form errors
    setValue, // Function to set form value programmatically
    watch // Function to watch form values
  } = useForm<IssueFormShape>({
    defaultValues: { selectedInstanceId: null },
  });

  // Watch the selected instance ID
  const selectedInstanceId = watch('selectedInstanceId');

  // --- Effect to reset form when modal opens or type changes ---
  useEffect(() => {
    if (open) {
        // Reset selected type and instance when modal opens
        setSelectedAssetTypeId('');
        reset({ selectedInstanceId: null }); // Reset form
        setSubmitError(null); // Clear previous errors
    }
  }, [open, reset]);

  // Effect to reset selected instance when type changes
   useEffect(() => {
        reset({ selectedInstanceId: null }); // Reset instance selection when type changes
   }, [selectedAssetTypeId, reset]);

  // --- Handlers ---
  const handleAssetTypeChange = (event: SelectChangeEvent<string>) => {
    setSelectedAssetTypeId(event.target.value);
  };

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing during submission
    onClose();
  };

  // --- Form Submission Handler ---
  const onSubmit: SubmitHandler<IssueFormShape> = async (data) => {
    if (!employeeId || !data.selectedInstanceId) {
      setSubmitError("Будь ласка, виберіть тип активу та конкретний екземпляр.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      employeeId: employeeId,
      instanceId: parseInt(data.selectedInstanceId, 10), // Convert string ID back to number
    };

    try {
      const response = await fetch(`/api/asset-instances/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      onSubmitSuccess(result as AssignedInstanceData); // Pass assigned data back
      onClose(); // Close modal on success

    } catch (error) {
      console.error('Failed to assign asset:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format purchase date
  const formatPurchaseDate = (dateString: string): string => {
    try {
        return new Date(dateString).toLocaleDateString('uk-UA');
    } catch {
        return 'N/A';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Видати інвентар співробітнику: {employeeName}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent dividers> {/* Add dividers for better separation */}

          {/* --- General Submit Error Alert --- */}
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {/* --- Step 1: Select Asset Type --- */}
          <FormControl fullWidth margin="normal" error={!!assetTypesError}>
            <InputLabel id="asset-type-select-label">1. Оберіть Тип Активу</InputLabel>
            <Select
              labelId="asset-type-select-label"
              id="asset-type-select"
              value={selectedAssetTypeId}
              label="1. Оберіть Тип Активу"
              onChange={handleAssetTypeChange}
              disabled={isSubmitting}
            >
              <MenuItem value="" disabled>
                <em>-- Виберіть тип --</em>
              </MenuItem>
              {assetTypesError && <MenuItem disabled><Alert severity="error" sx={{width: '100%'}}>Помилка завантаження типів</Alert></MenuItem>}
              {!assetTypesError && !assetTypes && <MenuItem disabled><CircularProgress size={20} /></MenuItem>}
              {assetTypes?.map((type) => (
                <MenuItem key={type.id} value={type.id.toString()}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
             {assetTypesError && <FormHelperText error>Не вдалося завантажити типи активів.</FormHelperText>}
          </FormControl>

          {/* --- Step 2: Select Specific Instance/Batch --- */}
          {selectedAssetTypeId && ( // Show only after type is selected
            <FormControl
                fullWidth
                margin="normal"
                component="fieldset" // Important for RadioGroup accessibility
                error={!!formErrors.selectedInstanceId} // Show error state if selection is invalid
                disabled={isSubmitting}
            >
              <FormLabel component="legend" sx={{ mb: 1 }}>2. Оберіть Екземпляр/Партію для Видачі</FormLabel>
              {isLoadingInstances && <Box sx={{textAlign: 'center', my: 2}}><CircularProgress /></Box>}
              {instancesError && <Alert severity="error">Помилка завантаження доступних екземплярів.</Alert>}
              {!isLoadingInstances && !instancesError && (
                availableInstances?.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', my: 2 }}>
                    Немає доступних екземплярів цього типу на складі.
                  </Typography>
                ) : (
                  // Use Controller with RadioGroup for selection
                  <Controller
                    name="selectedInstanceId"
                    control={control}
                    rules={{ required: 'Необхідно вибрати екземпляр' }} // Add validation rule
                    render={({ field }) => (
                      <RadioGroup {...field} aria-label="available assets" name="available-assets-group">
                        <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                          {availableInstances?.map((inst, index) => (
                            <ListItem
                                key={inst.instanceId}
                                divider={index < availableInstances.length - 1}
                                secondaryAction={ // Show quantity chip
                                    <Chip label={`К-сть: ${inst.quantity}`} size="small" />
                                }
                                sx={{ pl: 0 }} // Adjust padding for radio button
                            >
                              <FormControlLabel
                                value={inst.instanceId.toString()} // Value must be string for RadioGroup
                                control={<Radio size="small" />}
                                label={
                                    <ListItemText // Use ListItemText inside label for better layout
                                        primary={`Інв. №: ${inst.inventoryNumber}`}
                                        secondary={`Вартість: ${inst.unit_cost} грн, Дата надх.: ${formatPurchaseDate(inst.purchase_date)}${inst.notes ? `, Примітка: ${inst.notes}` : ''}`}
                                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                    />
                                }
                                sx={{ flexGrow: 1, mr: 1 }} // Allow label to take space
                              />

                            </ListItem>
                          ))}
                        </List>
                      </RadioGroup>
                    )}
                  />
                )
              )}
               {/* Display validation error for radio group */}
               {formErrors.selectedInstanceId && <FormHelperText error>{formErrors.selectedInstanceId.message}</FormHelperText>}
            </FormControl>
          )}

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isSubmitting} color="inherit">
            Скасувати
          </Button>
          <Button
             type="submit"
             variant="contained"
             disabled={isSubmitting || !selectedInstanceId} // Disable if submitting or no instance selected
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Видати Актив'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
