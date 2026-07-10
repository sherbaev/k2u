import React from 'react';
import { Card, CardContent, Typography, Box, Stack, Divider } from '@mui/material';
import StatusBadge from './StatusBadge.jsx';

function safeRatio(numerator, denominator) {
  if (!denominator || Number.isNaN(numerator) || Number.isNaN(denominator)) {
    return '—';
  }
  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio)) return '—';
  return ratio.toFixed(3);
}

function fmt(value, decimals = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

export default function OperatingPointCard({ telemetry }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Operating point
        </Typography>

        {!telemetry ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for data…
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="baseline" spacing={2}>
              <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
                {fmt(telemetry.k2u)}%
              </Typography>
              <StatusBadge status={telemetry.status} size="medium" />
            </Stack>

            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Phase angle φ₂
                </Typography>
                <Typography variant="body1">{fmt(telemetry.phi2)}°</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Frequency
                </Typography>
                <Typography variant="body1">{fmt(telemetry.freq)} Hz</Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  U_BC / U_AB
                </Typography>
                <Typography variant="body1">
                  {safeRatio(telemetry.u_bc, telemetry.u_ab)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  U_CA / U_AB
                </Typography>
                <Typography variant="body1">
                  {safeRatio(telemetry.u_ca, telemetry.u_ab)}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack direction="row" spacing={4}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  U_A
                </Typography>
                <Typography variant="body1">{fmt(telemetry.u_a)} V</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  U_B
                </Typography>
                <Typography variant="body1">{fmt(telemetry.u_b)} V</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  U_C
                </Typography>
                <Typography variant="body1">{fmt(telemetry.u_c)} V</Typography>
              </Box>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
