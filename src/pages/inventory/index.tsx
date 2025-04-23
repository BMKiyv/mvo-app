// pages/inventory/index.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router'; // Import router to read/write query params

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip'; // To show stock status
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';

// Import Modal components (placeholders for now)
// import AddAssetTypeModal from '../../components/AddAssetTypeModal';
// import EditAssetTypeModal from '../../components/EditAssetTypeModal';

// --- Fetcher function ---
const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
         return res.json().then(info => { (error as any).info = info; throw error; })
                         .catch(() => { throw error; });
    }
    return res.json();
});

// --- Types ---
type AssetCategoryOption = {
  id: number;
  name: string;
};

type AssetTypeWithCounts = {
  id: number;
  name: string;
  minimum_stock_level: number | null;
  notes: string | null;
  categoryId: number;
  categoryName: string | null;
  totalQuantity: number;
  onStockQuantity: number;
  createdAt: string; // Date comes as string
};

// --- Inventory Page Component ---
export default function InventoryPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // State for category filter - read initial value from router query
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>(
      (router.query.categoryId as string) || '' // Initialize from URL query param or empty
  );

  // State for action menu
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedAssetType, setSelectedAssetType] = React.useState<AssetTypeWithCounts | null>(null);
  const menuOpen = Boolean(anchorEl);

  // State for modals (placeholders)
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);

  // State for Snackbar
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' } | null>(null);


  // --- Data Fetching ---
  // Fetch categories for the filter dropdown
  const { data: categories, error: categoriesError } = useSWR<AssetCategoryOption[]>('/api/asset-categories', fetcher);

  // Construct the URL for asset types based on the selected category
  const assetTypesUrl = selectedCategoryId
    ? `/api/asset-types?categoryId=${selectedCategoryId}`
    : '/api/asset-types'; // Fetch all if no category selected

  // Fetch asset types based on the URL
  const { data: assetTypes, error: assetTypesError, isLoading: isLoadingAssetTypes } = useSWR<AssetTypeWithCounts[]>(
      assetTypesUrl, // URL depends on selectedCategoryId
      fetcher
  );

  // --- Effects ---
  // Update state if router query changes (e.g., browser back/forward)
  React.useEffect(() => {
      if (router.isReady) { // Ensure router is ready before accessing query
          const queryCategoryId = (router.query.categoryId as string) || '';
          if (queryCategoryId !== selectedCategoryId) {
              setSelectedCategoryId(queryCategoryId);
          }
      }
  }, [router.query.categoryId, router.isReady, selectedCategoryId]);


  // --- Handlers ---
  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    const newCategoryId = event.target.value;
    setSelectedCategoryId(newCategoryId);
    // Update URL query parameter to reflect filter change
    router.push(
        {
            pathname: router.pathname, // Keep current path
            query: newCategoryId ? { categoryId: newCategoryId } : {}, // Set or remove query param
        },
        undefined, // Use 'undefined' for shallow routing if desired, or omit for full navigation
        { shallow: true } // Use shallow routing to avoid full page reload
    );
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, assetType: AssetTypeWithCounts) => {
    setAnchorEl(event.currentTarget);
    setSelectedAssetType(assetType);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAssetType(null);
  };

  // Placeholder handlers for modal actions
  const handleOpenAddModal = () => {
      setAddModalOpen(true);
      console.log("Open Add Asset Type Modal");
      setSnackbar({open: true, message: 'Функція додавання типу активу ще не реалізована.', severity: 'info'});
  };
  const handleCloseAddModal = () => setAddModalOpen(false);
  const handleAddSuccess = (/* newAssetType */) => {
      console.log("Asset type added");
      mutate(assetTypesUrl); // Revalidate data after adding
      setSnackbar({open: true, message: 'Тип активу успішно додано!', severity: 'success'});
  };

  const handleOpenEditModal = () => {
      if (selectedAssetType) {
          setEditModalOpen(true);
          console.log("Open Edit Asset Type Modal for:", selectedAssetType.name);
          setSnackbar({open: true, message: 'Функція редагування типу активу ще не реалізована.', severity: 'info'});
      }
      handleMenuClose();
  };
  const handleCloseEditModal = () => setEditModalOpen(false);
   const handleEditSuccess = (/* updatedAssetType */) => {
      console.log("Asset type updated");
      mutate(assetTypesUrl); // Revalidate data after editing
      setSnackbar({open: true, message: 'Тип активу успішно оновлено!', severity: 'success'});
  };


  const handleDelete = async () => {
    const typeToDelete = selectedAssetType;
    handleMenuClose();

    if (typeToDelete) {
        // TODO: Implement check if instances exist before deleting category
        // Example check (requires a dedicated API endpoint or modification):
        // const canDelete = await checkCanDeleteAssetType(typeToDelete.id);
        // if (!canDelete) {
        //    setSnackbar({open: true, message: 'Неможливо видалити тип, доки існують його екземпляри.', severity: 'error'});
        //    return;
        // }

        const confirmed = confirm(`Ви впевнені, що хочете видалити тип "${typeToDelete.name}"? Це не можна буде скасувати.`);
        if (confirmed) {
            try {
                // TODO: Implement DELETE /api/asset-types/[id] endpoint
                // const response = await fetch(`/api/asset-types/${typeToDelete.id}`, { method: 'DELETE' });
                // if (!response.ok) {
                //     const errorData = await response.json();
                //     throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                // }
                // mutate(assetTypesUrl, (currentData: AssetTypeWithCounts[] = []) => {
                //      return currentData.filter(at => at.id !== typeToDelete.id);
                // }, false);
                // setSnackbar({ open: true, message: `Тип "${typeToDelete.name}" видалено.`, severity: 'success' });
                 setSnackbar({ open: true, message: 'Функція видалення типу активу ще не реалізована.', severity: 'info' });

            } catch (err) {
                console.error('Error during delete request:', err);
                setSnackbar({ open: true, message: `Помилка видалення: ${err instanceof Error ? err.message : 'Невідома помилка'}`, severity: 'error' });
            }
        }
    }
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar(null);
  };

  // Helper to determine stock level status
  const getStockLevelChip = (type: AssetTypeWithCounts) => {
      if (type.minimum_stock_level === null) {
          return null; // No chip if minimum level is not set
      }
      if (type.onStockQuantity < type.minimum_stock_level) {
          return <Chip label="Низький залишок" color="warning" size="small" variant="outlined" />;
      }
      if (type.onStockQuantity === type.minimum_stock_level) {
          return <Chip label="Мін. рівень" color="info" size="small" variant="outlined" />;
      }
      return <Chip label="Достатньо" color="success" size="small" variant="outlined" />;
  };


  return (
    <Box>
      {/* --- Page Header & Controls --- */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h4" component="h1">
          Інвентар (Типи Активів)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', sm: 'auto'} }}>
          {/* Category Filter */}
          <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto'} }} size="small">
            <InputLabel id="category-filter-label">Фільтр за категорією</InputLabel>
            <Select
              labelId="category-filter-label"
              value={selectedCategoryId}
              label="Фільтр за категорією"
              onChange={handleCategoryChange}
              disabled={!!categoriesError || !categories} // Disable if categories loading/error
            >
              <MenuItem value="">
                <em>Всі категорії</em>
              </MenuItem>
              {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка завантаження</MenuItem>}
              {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20} sx={{mx: 'auto', display: 'block'}}/></MenuItem>}
              {categories?.map((cat) => (
                <MenuItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Add Button */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddModal}
            sx={{ width: { xs: '100%', sm: 'auto'} }}
          >
            Додати Тип
          </Button>
        </Box>
      </Box>

      {/* Loading/Error States for Asset Types */}
      {isLoadingAssetTypes && ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box> )}
      {assetTypesError && !isLoadingAssetTypes && ( <Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити типи активів. {(assetTypesError as any).info?.message || assetTypesError.message} </Alert> )}

      {/* --- Data Table --- */}
      {!isLoadingAssetTypes && !assetTypesError && assetTypes && (
        <TableContainer component={Paper} elevation={3}>
          <Table sx={{ minWidth: 750 }} aria-label="asset types table">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Назва Типу Активу</TableCell>
                <TableCell>Категорія</TableCell>
                <TableCell align="right">На Складі</TableCell>
                <TableCell align="right">Всього</TableCell>
                <TableCell>Мін. Залишок</TableCell>
                <TableCell>Статус Залишку</TableCell>
                <TableCell>Примітки</TableCell>
                <TableCell align="right">Дії</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assetTypes.length === 0 ? (
                 <TableRow><TableCell colSpan={8} align="center">Типів активів не знайдено (або не відповідають фільтру).</TableCell></TableRow>
              ) : (
                assetTypes.map((assetType) => (
                  <TableRow key={assetType.id} hover>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                        {/* TODO: Make this a link to a page showing instances of this type */}
                        {assetType.name}
                    </TableCell>
                    <TableCell>{assetType.categoryName ?? 'N/A'}</TableCell>
                    <TableCell align="right">{assetType.onStockQuantity}</TableCell>
                    <TableCell align="right">{assetType.totalQuantity}</TableCell>
                    <TableCell>{assetType.minimum_stock_level ?? '-'}</TableCell>
                    <TableCell>{getStockLevelChip(assetType)}</TableCell>
                    <TableCell>
                        <Tooltip title={assetType.notes || ''} placement="top-start">
                            <Typography variant="body2" noWrap sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {assetType.notes || '-'}
                            </Typography>
                        </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="actions" onClick={(event) => handleMenuClick(event, assetType)}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- Action Menu --- */}
      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
        {/* TODO: Add View Instances action */}
        {/* <MenuItem onClick={handleViewInstances}><ListItemIcon><ListAltIcon fontSize="small" /></ListItemIcon><ListItemText>Екземпляри</ListItemText></MenuItem> */}
        <MenuItem onClick={handleOpenEditModal}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Редагувати</ListItemText></MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }}/></ListItemIcon><ListItemText>Видалити</ListItemText></MenuItem>
      </Menu>

      {/* --- Modals (Placeholders) --- */}
       {/* <AddAssetTypeModal open={addModalOpen} onClose={handleCloseAddModal} onSubmitSuccess={handleAddSuccess} categories={categories || []} /> */}
       {/* {selectedAssetType && <EditAssetTypeModal open={editModalOpen} onClose={handleCloseEditModal} onSubmitSuccess={handleEditSuccess} assetType={selectedAssetType} categories={categories || []} />} */}


       {/* --- Snackbar --- */}
       {snackbar && (
           <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
             <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
               {snackbar.message}
             </Alert>
           </Snackbar>
       )}

    </Box>
  );
}
