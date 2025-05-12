// pages/inventory/index.tsx
'use client';

import * as React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/router';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CategoryIcon from '@mui/icons-material/Category';
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
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import NextLink from 'next/link';
import FormHelperText from '@mui/material/FormHelperText';
import UploadFileIcon from '@mui/icons-material/UploadFile';

// Import Modal components
import AddAssetTypeModal from '../../components/AddAssetTypeModal';
import EditAssetTypeModal from '../../components/EditAssetTypeModal';
import AddAssetInstanceModal from '../../components/AddAssetInstanceModal';
import AddCategoryModal from '../../components/AddCategoryModal'; // Import Add Category Modal
import AssetImportModal from '@/components/AssetImportModal';

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
type AssetCategoryOption = { id: number; name: string; };
type AssetTypeWithCounts = {
  id: number; name: string; minimum_stock_level: number | null; notes: string | null;
  categoryId: number; categoryName: string | null; totalQuantity: number;
  onStockQuantity: number; createdAt: string;
};
type AssetTypeApiResponse = {
    id: number; name: string; categoryId: number;
    minimum_stock_level: number | null; notes: string | null;
};
type AssetInstanceApiResponse = { id: number; /* ... інші поля ... */ };
type CategoryApiResponse = { id: number; name: string; /* ... */ };


// --- Inventory Page Component ---
export default function InventoryPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // States...
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>((router.query.categoryId as string) || '');
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedAssetType, setSelectedAssetType] = React.useState<AssetTypeWithCounts | null>(null);
  const menuOpen = Boolean(anchorEl);
  const [addTypeModalOpen, setAddTypeModalOpen] = React.useState(false);
  const [editTypeModalOpen, setEditTypeModalOpen] = React.useState(false);
  const [assetTypeToEdit, setAssetTypeToEdit] = React.useState<AssetTypeWithCounts | null>(null);
  const [addInstanceModalOpen, setAddInstanceModalOpen] = React.useState(false);
  const [assetTypeForInstance, setAssetTypeForInstance] = React.useState<{id: number; name: string} | null>(null);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = React.useState(false); // State for Add Category Modal
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' } | null>(null);


  // --- Data Fetching ---
  const categoriesUrl = '/api/asset-categories';
  const { data: categories, error: categoriesError, mutate: mutateCategories } = useSWR<AssetCategoryOption[]>(categoriesUrl, fetcher);
  const assetTypesUrl = selectedCategoryId ? `/api/asset-types?categoryId=${selectedCategoryId}` : '/api/asset-types';
  const { data: assetTypes, error: assetTypesError, isLoading: isLoadingAssetTypes } = useSWR<AssetTypeWithCounts[]>(assetTypesUrl, fetcher);

  // --- Effects ---
  React.useEffect(() => {
      if (router.isReady) {
          const queryCategoryId = (router.query.categoryId as string) || '';
          if (queryCategoryId !== selectedCategoryId) { setSelectedCategoryId(queryCategoryId); }
      }
  }, [router.query.categoryId, router.isReady, selectedCategoryId]);


  // --- Handlers ---
  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    const newCategoryId = event.target.value;
    setSelectedCategoryId(newCategoryId);
    router.push(
        { pathname: router.pathname, query: newCategoryId ? { categoryId: newCategoryId } : {} },
        undefined, { shallow: true }
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

   const handleOpenImportModal = () => {
        setImportModalOpen(true);
    };

    const handleCloseImportModal = () => {
        setImportModalOpen(false);
    };

     // Ця функція буде викликана з AssetImportModal після успішного імпорту
    const handleImportSuccess = (count: number) => {
        setImportModalOpen(false); // Закриваємо модал
        mutate(assetTypesUrl); // Оновлюємо список типів (щоб побачити нові та оновити лічильники)
        setSnackbar({open: true, message: `Успішно імпортовано ${count} записів.`, severity: 'success'});
    };


  // --- Add Type Modal Handlers ---
  const handleOpenAddTypeModal = () => { setAddTypeModalOpen(true); };
  const handleCloseAddTypeModal = () => { setAddTypeModalOpen(false); };
  const handleAddTypeSuccess = (newAssetType: AssetTypeApiResponse) => {
      mutate(assetTypesUrl);
      setSnackbar({open: true, message: `Тип "${newAssetType.name}" успішно додано!`, severity: 'success'});
  };

  // --- Edit Type Modal Handlers ---
  const handleOpenEditTypeModal = () => {
      if (selectedAssetType) {
          setAssetTypeToEdit(selectedAssetType);
          setEditTypeModalOpen(true);
      }
      handleMenuClose();
  };
  const handleCloseEditTypeModal = () => {
      setEditTypeModalOpen(false);
      setAssetTypeToEdit(null);
  };
   const handleEditTypeSuccess = (updatedAssetType: AssetTypeApiResponse) => {
      mutate(assetTypesUrl, (currentData: AssetTypeWithCounts[] = []) => {
           return currentData.map(at => at.id === updatedAssetType.id ? { ...at, ...updatedAssetType } : at);
      }, false);
      setSnackbar({open: true, message: `Тип "${updatedAssetType.name}" успішно оновлено!`, severity: 'success'});
  };

   // --- Add Instance/Batch Modal Handlers ---
   const handleOpenAddInstanceModal = () => {
        if (selectedAssetType) {
            setAssetTypeForInstance({ id: selectedAssetType.id, name: selectedAssetType.name });
            setAddInstanceModalOpen(true);
        } else {
            console.error("Cannot open Add Instance modal: selectedAssetType is null");
            setSnackbar({open: true, message: 'Спочатку виберіть тип активу з меню.', severity: 'error'});
        }
        handleMenuClose();
   };
   const handleCloseAddInstanceModal = () => {
        setAddInstanceModalOpen(false);
        setAssetTypeForInstance(null);
   };
    const handleAddInstanceSuccess = (newInstance: AssetInstanceApiResponse) => {
        mutate(assetTypesUrl); // Revalidate asset type list to update counts
        setSnackbar({open: true, message: 'Партію/екземпляр успішно додано!', severity: 'success'});
   };

   // --- Add Category Modal Handlers ---
   const handleOpenAddCategoryModal = () => {
       setAddCategoryModalOpen(true); // <--- Відкриваємо модал
       // setSnackbar({open: true, message: 'Функція додавання категорії ще не реалізована.', severity: 'info'}); // <--- ВИДАЛЕНО ЦЕЙ РЯДОК
       // console.log("Open Add Category Modal");
   };
    const handleCloseAddCategoryModal = () => {
        setAddCategoryModalOpen(false);
    };
    const handleAddCategorySuccess = (newCategory: CategoryApiResponse) => { // <--- Тип для нової категорії
        console.log("Category added:", newCategory);
        mutateCategories(); // Revalidate categories list
        setSnackbar({open: true, message: `Категорію "${newCategory.name}" успішно додано!`, severity: 'success'});
        // Модал закривається сам
    };


  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar(null);
  };

  // Helper to determine stock level status
  const getStockLevelChip = (type: AssetTypeWithCounts) => {
      if (type.minimum_stock_level === null) return null;
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
        {/* --- Buttons Group --- */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: { xs: '100%', sm: 'auto'} }}>
          {/* Category Filter */}
          <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto'} }} size="small">
            <InputLabel id="category-filter-label">Фільтр за категорією</InputLabel>
            <Select
              labelId="category-filter-label"
              value={selectedCategoryId}
              label="Фільтр за категорією"
              onChange={handleCategoryChange}
              disabled={!!categoriesError || !categories}
            >
              <MenuItem value=""><em>Всі категорії</em></MenuItem>
              {categoriesError && <MenuItem disabled sx={{color: 'error.main'}}>Помилка завантаження</MenuItem>}
              {!categoriesError && !categories && <MenuItem disabled><CircularProgress size={20} sx={{mx: 'auto', display: 'block'}}/></MenuItem>}
              {categories?.map((cat) => ( <MenuItem key={cat.id} value={cat.id.toString()}>{cat.name}</MenuItem> ))}
            </Select>
             {categoriesError && <FormHelperText error>Помилка завантаження категорій</FormHelperText>}
          </FormControl>
          {/* Add Category Button */}
           <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={handleOpenAddCategoryModal}
            sx={{ width: { xs: '100%', sm: 'auto'} }}
          >
            Додати Категорію
          </Button>
          {/* Add Type Button */}
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddTypeModal} sx={{ width: { xs: '100%', sm: 'auto'} }}>
            Додати Тип
          </Button>
        </Box>
      </Box>

      {/* Loading/Error States for Asset Types */}
      {isLoadingAssetTypes && ( <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box> )}
      {assetTypesError && !isLoadingAssetTypes && ( <Alert severity="error" sx={{ mb: 2 }}> Не вдалося завантажити типи активів. {(assetTypesError as any).info?.message || assetTypesError.message} </Alert> )}

      {/* --- Data Table --- */}
      {!isLoadingAssetTypes && !assetTypesError && assetTypes && (
        <>
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
                        <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>{assetType.name}</TableCell>
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

            {/* --- Write-off Button --- */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 1, gap: 2 }}>
                         <Button
               variant="outlined"
               startIcon={<UploadFileIcon />} // Переконайтесь, що імпортували UploadFileIcon
               onClick={handleOpenImportModal} // Використовуємо ваш хендлер
           >
               Імпорт з файлу
           </Button>
                <Button variant="outlined" color="secondary" component={NextLink} href="/inventory/write-off" >
                    Списати Активи
                </Button>
            </Box>
        </>
      )}

      {/* --- Action Menu --- */}
      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem onClick={handleOpenAddInstanceModal}><ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon><ListItemText>Додати Партію/Екземпляр</ListItemText></MenuItem>
        <MenuItem onClick={handleOpenEditTypeModal}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Редагувати Тип</ListItemText></MenuItem>
      </Menu>

      {/* --- Modals --- */}
       <AddAssetTypeModal
            open={addTypeModalOpen}
            onClose={handleCloseAddTypeModal}
            onSubmitSuccess={handleAddTypeSuccess}
            categories={categories}
            categoriesError={categoriesError}
        />
       <EditAssetTypeModal
            open={editTypeModalOpen}
            onClose={handleCloseEditTypeModal}
            onSubmitSuccess={handleEditTypeSuccess}
            assetType={assetTypeToEdit}
            categories={categories}
            categoriesError={categoriesError}
        />
        <AddAssetInstanceModal
            open={addInstanceModalOpen}
            onClose={handleCloseAddInstanceModal}
            onSubmitSuccess={handleAddInstanceSuccess}
            assetType={assetTypeForInstance}
        />
        {/* Render Add Category Modal */}
        <AddCategoryModal
            open={addCategoryModalOpen}
            onClose={handleCloseAddCategoryModal}
            onSubmitSuccess={handleAddCategorySuccess}
         />
                 <AssetImportModal
            open={importModalOpen}
            onClose={handleCloseImportModal}
            onImportSuccess={handleImportSuccess} // Передаємо callback
         />

       {/* --- Snackbar --- */}
       {snackbar && ( <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
             <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
           </Snackbar>
       )}

    </Box>
  );
}
