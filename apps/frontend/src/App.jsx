import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Stack,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  ListItemAvatar,
} from "@mui/material";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Radio,
  PenLine,
  FileText,
  FlaskConical,
  Cpu,
  Wifi,
  WifiOff,
  LogOut,
  LogIn,
  ChevronDown,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import Devices from "./pages/Devices.jsx";
import ManualEntry from "./pages/ManualEntry.jsx";
import Reports from "./pages/Reports.jsx";
import Research from "./pages/Research.jsx";
import Setup from "./pages/Setup.jsx";
import Login from "./pages/Login.jsx";
import { isAuthed, signOut, currentUser } from "./lib/auth.js";
import { useLive } from "./lib/useLive.js";
import { useThemeMode } from "./lib/ThemeModeContext.jsx";
import { useShowCoords, setShowCoords } from "./lib/prefs.js";

const DRAWER_WIDTH = 232;

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/devices", label: "Devices", icon: Radio },
  { to: "/manual", label: "Manual entry", icon: PenLine },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/research", label: "Research", icon: FlaskConical },
  { to: "/setup", label: "Setup", icon: Cpu },
];

function NavList({ onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <List sx={{ px: 0, py: 1 }}>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <ListItemButton
            key={to}
            selected={active}
            onClick={() => {
              navigate(to);
              onNavigate && onNavigate();
            }}
            sx={{
              mb: 0.5,
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "#fff",
                "&:hover": { bgcolor: "primary.dark" },
                "& .MuiListItemIcon-root": { color: "#fff" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon size={19} />
            </ListItemIcon>
            <ListItemText
              primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: active ? 700 : 500 }}
            >
              {label}
            </ListItemText>
          </ListItemButton>
        );
      })}
    </List>
  );
}

function AppShell({ children }) {
  const { connected } = useLive();
  const navigate = useNavigate();
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const authed = isAuthed();
  const user = currentUser();
  const { mode, toggle } = useThemeMode();
  const showCoords = useShowCoords();

  function handleSignOut() {
    setUserMenuAnchor(null);
    signOut();
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar sx={{ px: 2.5, py: 2, minHeight: "64px !important" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "9px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: "linear-gradient(135deg, #155e9c, #0f8b8d)",
              }}
            >
              <Activity size={18} color="#fff" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                K₂U Monitoring
              </Typography>
              <Typography variant="caption" color="text.secondary">
                GOST 32144-2013
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
        <Divider />
        <Box sx={{ px: 1, flexGrow: 1 }}>
          <NavList />
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Chip
            size="small"
            icon={connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            color={connected ? "success" : "default"}
            label={connected ? "Live feed connected" : "Disconnected"}
            sx={{ width: "100%", justifyContent: "flex-start" }}
          />
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ justifyContent: "flex-end", gap: 2 }}>
            <Chip
              size="small"
              variant="outlined"
              label="GOST 32144-2013"
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            />
            <IconButton
              onClick={() => setShowCoords(!showCoords)}
              size="small"
              aria-label="Toggle coordinate visibility"
              title={showCoords ? "Hide coordinates" : "Show coordinates"}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "8px",
              }}
            >
              {showCoords ? <Eye size={17} /> : <EyeOff size={17} />}
            </IconButton>
            <IconButton
              onClick={toggle}
              size="small"
              aria-label="Toggle color mode"
              title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "8px",
              }}
            >
              {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </IconButton>
            {authed ? (
              <>
                <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} size="small">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 30, height: 30, fontSize: "0.85rem", bgcolor: "primary.main" }}>
                      {user.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <ChevronDown size={16} />
                  </Stack>
                </IconButton>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={() => setUserMenuAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: "0.8rem" }}>
                        {user.slice(0, 1).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user}
                      secondary="Beta account"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleSignOut}>
                    <ListItemIcon>
                      <LogOut size={16} />
                    </ListItemIcon>
                    Sign out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Chip
                size="small"
                variant="outlined"
                clickable
                icon={<LogIn size={14} />}
                label="Sign in"
                onClick={() => navigate("/login")}
              />
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>{children}</Box>
      </Box>
    </Box>
  );
}

/**
 * The app is publicly viewable — no auth gate. `/login` is an optional,
 * purely cosmetic sign-in affordance (see lib/auth.js) that only changes the
 * user chip in the toolbar; it never blocks access to any page or data.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/manual" element={<ManualEntry />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/research" element={<Research />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
