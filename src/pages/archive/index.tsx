// --- pages/archive/index.tsx (Архів) ---
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
// Import Tabs, Table components etc.

export function ArchivePage() { // Changed to named export
  // TODO: Fetch archived employees from /api/employees/archived
  // TODO: Fetch written-off assets from /api/asset-instances/archived
  // TODO: Implement Tabs to switch between archived employees and assets
  // TODO: Implement Restore/Permanent Delete functionality

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Архів
      </Typography>
      {/* TODO: Add Tabs component here (Archived Employees, Written-off Assets) */}
      <Typography>
        Тут будуть списки звільнених співробітників та списаних активів з можливістю відновлення або остаточного видалення.
      </Typography>
    </Box>
  );
}
export default ArchivePage; // Export default