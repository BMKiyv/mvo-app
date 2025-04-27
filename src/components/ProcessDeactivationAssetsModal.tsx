// components/ProcessDeactivationAssetsModal.tsx
'use client';

import * as React from 'react';
import useSWR from 'swr';
// Переконайтесь, що цей імпорт працює після prisma generate
import { AssetStatus } from '@prisma/client';

// MUI Components
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

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
type AssignedAssetData = {
  instanceId: number;
  inventoryNumber: string;
  assetTypeName: string;
};

type AssetStatusMap = {
    [instanceId: number]: AssetStatus;
};

type ProcessAssetsResponse = {
    message: string;
    processedCount: number;
};

type ApiErrorData = {
    message: string;
    details?: any;
};

interface ProcessDeactivationAssetsModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number | null;
  employeeName: string;
  onProcessingComplete: (success: boolean, processedCount?: number) => void;
}

// --- Компонент Модального Вікна ---
export default function ProcessDeactivationAssetsModal({
  open,
  onClose,
  employeeId,
  employeeName,
  onProcessingComplete,
}: ProcessDeactivationAssetsModalProps) {

  const [assetStatuses, setAssetStatuses] = React.useState<AssetStatusMap>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const assetsUrl = employeeId ? `/api/employees/${employeeId}/assets` : null;
  const { data: assets, error: assetsError, isLoading: isLoadingAssets } = useSWR<AssignedAssetData[]>(
      assetsUrl, fetcher, { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    if (assets && open) {
      const initialStatuses: AssetStatusMap = {};
      assets.forEach(asset => {
        initialStatuses[asset.instanceId] = assetStatuses[asset.instanceId] ?? AssetStatus.on_stock;
      });
      setAssetStatuses(initialStatuses);
       setSubmitError(null);
    } else if (!open) {
        setAssetStatuses({});
        setSubmitError(null);
    }
  }, [assets, open]); // Removed assetStatuses from dependency array

  const handleStatusChange = (instanceId: number, event: SelectChangeEvent<AssetStatus>) => {
    const newStatus = event.target.value as AssetStatus;
    setAssetStatuses(prev => ({ ...prev, [instanceId]: newStatus }));
  };

  const handleSubmit = async () => {
    if (!employeeId || !assets) return;

    const allStatusesSet = assets.every(asset => assetStatuses[asset.instanceId] !== undefined);
    if (!allStatusesSet) {
        setSubmitError("Будь ласка, виберіть кінцевий статус для всіх активів.");
        return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      assets: assets.map(asset => ({
        instanceId: asset.instanceId,
        finalStatus: assetStatuses[asset.instanceId],
      })),
    };

    try {
      const response = await fetch(`/api/employees/${employeeId}/process-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: ProcessAssetsResponse | ApiErrorData = await response.json();

      if (!response.ok) {
        throw new Error((result as ApiErrorData).message || `HTTP error! status: ${response.status}`);
      }

      onProcessingComplete(true, (result as ProcessAssetsResponse).processedCount);
      onClose();

    } catch (error) {
      console.error('Failed to process assets:', error);
      setSubmitError(error instanceof Error ? error.message : 'Сталася невідома помилка.');
      onProcessingComplete(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { if (!isSubmitting) onClose(); };

  // --- Статуси для випадаючого списку ---
  // These should now exist in AssetStatus after prisma generate
  const statusOptions: { value: AssetStatus; label: string }[] = [
      { value: AssetStatus.on_stock, label: 'Повернено на склад' },
      { value: AssetStatus.damaged, label: 'Пошкоджено' },
      { value: AssetStatus.lost, label: 'Втрачено' },
      { value: AssetStatus.unreturned, label: 'Не повернуто' },
  ];


  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Обробка Активів при Звільненні: {employeeName}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
            Будь ласка, вкажіть кінцевий статус для кожного активу, що був виданий цьому співробітнику.
        </Typography>

        {submitError && ( <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert> )}
        {isLoadingAssets && ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box> )}
        {assetsError && !isLoadingAssets && ( <Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити список активів. {(assetsError as any).info?.message || assetsError.message} </Alert> )}

        {!isLoadingAssets && !assetsError && assets && (
            assets.length === 0 ? (
                <Typography sx={{ textAlign: 'center', my: 3, color: 'text.secondary' }}>
                    За цим співробітником не закріплено жодних активів.
                </Typography>
            ) : (
                <List dense sx={{mt: 2}}>
                    {assets.map((asset, index) => (
                        <React.Fragment key={asset.instanceId}>
                            <ListItem sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                                <ListItemText
                                    primary={`${asset.assetTypeName} (Інв. №: ${asset.inventoryNumber})`}
                                    sx={{ flexGrow: 1, minWidth: '200px' }}
                                />
                                <FormControl sx={{ minWidth: 200 }} size="small" disabled={isSubmitting}>
                                    <Select
                                        value={assetStatuses[asset.instanceId] || ''}
                                        onChange={(e) => handleStatusChange(asset.instanceId, e)}
                                        displayEmpty
                                        inputProps={{ 'aria-label': `Status for ${asset.inventoryNumber}` }}
                                    >
                                        {statusOptions.map(option => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </ListItem>
                            {index < assets.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                    ))}
                </List>
            )
        )}

      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px' }}>
        <Button onClick={handleClose} disabled={isSubmitting} color="inherit"> Скасувати </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting || isLoadingAssets || !assets || assets.length === 0}>
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Підтвердити Обробку'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
