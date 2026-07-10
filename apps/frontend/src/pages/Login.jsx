import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  IconButton,
  Popover,
  Divider,
  InputAdornment,
} from "@mui/material";
import { Activity, HelpCircle, Lock, User } from "lucide-react";
import { signIn } from "../lib/auth.js";

const DEMO_USER = "admin";
const DEMO_PASS = "k2u-demo";

/**
 * Beta login screen. Auth is cosmetic — the backend does not enforce
 * credentials yet — so any non-empty username/password (or the demo pair)
 * signs the visitor in and drops a flag in localStorage.
 */
export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hintAnchor, setHintAnchor] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter a username and password to continue.");
      return;
    }
    signIn(username.trim());
    navigate("/", { replace: true });
  }

  function fillDemo() {
    setUsername(DEMO_USER);
    setPassword(DEMO_PASS);
    setError("");
    setHintAnchor(null);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        background:
          "radial-gradient(1100px 620px at 12% -10%, rgba(21,94,156,0.16), transparent 60%)," +
          "radial-gradient(900px 560px at 100% 110%, rgba(15,139,141,0.14), transparent 55%)," +
          "linear-gradient(180deg, #f4f6f9 0%, #eef2f6 100%)",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #155e9c, #0f8b8d)",
              boxShadow: "0 8px 24px rgba(21,94,156,0.35)",
            }}
          >
            <Activity color="#fff" size={28} strokeWidth={2.25} />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              K₂U Monitoring
            </Typography>
            <Chip
              label="Beta"
              size="small"
              color="secondary"
              sx={{ height: 20, fontSize: "0.7rem", color: "#fff" }}
            />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ maxWidth: 320 }}
          >
            Real-time voltage-unbalance (K₂U) monitoring &amp; compliance
            reporting per GOST 32144-2013
          </Typography>
        </Stack>

        <Card sx={{ boxShadow: "0 12px 32px rgba(16,24,40,0.10)" }}>
          <CardContent sx={{ p: 4 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Sign in</Typography>
              <IconButton
                size="small"
                onClick={(e) => setHintAnchor(e.currentTarget)}
                title="Demo credentials"
              >
                <HelpCircle size={18} />
              </IconButton>
            </Stack>

            <Popover
              open={Boolean(hintAnchor)}
              anchorEl={hintAnchor}
              onClose={() => setHintAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <Box sx={{ p: 2, maxWidth: 260 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Demo credentials
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  This is a beta build — authentication is not yet enforced.
                  Use the demo account below or any username/password.
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                  <Typography variant="body2">
                    Username: <b>{DEMO_USER}</b>
                  </Typography>
                  <Typography variant="body2">
                    Password: <b>{DEMO_PASS}</b>
                  </Typography>
                </Stack>
                <Button size="small" variant="outlined" fullWidth onClick={fillDemo}>
                  Fill demo credentials
                </Button>
              </Box>
            </Popover>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  fullWidth
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <User size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={16} />
                      </InputAdornment>
                    ),
                  }}
                />

                {error && (
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                )}

                <Button type="submit" variant="contained" size="large" fullWidth>
                  Sign in
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 3 }} />
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Beta access — credentials are not verified server-side yet.
              Click the <HelpCircle size={12} style={{ verticalAlign: "middle" }} /> icon above for
              a demo login.
            </Typography>
          </CardContent>
        </Card>

        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          display="block"
          sx={{ mt: 3 }}
        >
          GOST 32144-2013 · negative-sequence voltage unbalance (K₂U) monitoring platform
        </Typography>
      </Box>
    </Box>
  );
}
