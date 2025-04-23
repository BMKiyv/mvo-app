// --- pages/inventory/index.tsx (Інвентар - Типи Активів) ---
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
// Import Table, Filter components etc.

export function InventoryPage() { // Changed to named export
  // TODO: Fetch asset types data from /api/asset-types
  // TODO: Implement Filtering by category
  // TODO: Implement Add/Edit Modals for Asset Types
  // TODO: Implement logic to view instances of a type

  return (
    <Box>
       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" gutterBottom>
            Інвентар (Типи Активів)
          </Typography>
          {/* Add Filter Dropdown here */}
          <Button variant="contained" startIcon={<AddIcon />}>
            Додати Тип Активу
          </Button>
      </Box>
      {/* TODO: Add Table component here to display asset types */}
      <Typography>
        Тут буде таблиця з типами активів, фільтрацією та можливістю додавання/редагування.
      </Typography>
    </Box>
  );
}
export default InventoryPage; // Export default
