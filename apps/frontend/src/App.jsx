import { AppBar, Toolbar, Typography, Box, Chip, Button, Stack } from "@mui/material";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { Activity } from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import ManualEntry from "./pages/ManualEntry.jsx";
import Reports from "./pages/Reports.jsx";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Activity size={20} style={{ marginRight: 8 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            K₂U Monitoring
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1, ml: 3 }}>
            <Button size="small" color="inherit" component={Link} to="/">Dashboard</Button>
            <Button size="small" color="inherit" component={Link} to="/manual">Manual entry</Button>
            <Button size="small" color="inherit" component={Link} to="/reports">Reports</Button>
          </Stack>
          <Chip size="small" label="GOST 32144-2013" variant="outlined" />
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/manual" element={<ManualEntry />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}
