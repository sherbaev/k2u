import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  LinearProgress,
  Chip,
} from '@mui/material';

const BALANCER_NEED = {
  none: { label: 'Not needed', color: '#2e7d32' },
  recommended: { label: 'Recommended', color: '#ed6c02' },
  required: { label: 'Required', color: '#d32f2f' },
};

function pct(value, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return Number(value) * 100;
}

function fmtPct(value, decimals = 0) {
  const p = pct(value, decimals);
  return p === null ? '—' : p.toFixed(decimals);
}

export default function RulPanel({ prediction }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Remaining useful life (AI)
        </Typography>

        {!prediction ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No prediction yet
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  RUL
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {fmtPct(prediction.rul)}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, pct(prediction.rul) || 0))}
                sx={{ height: 10, borderRadius: 5 }}
              />
              {prediction.rul_lo !== undefined && prediction.rul_hi !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  [{fmtPct(prediction.rul_lo)}–{fmtPct(prediction.rul_hi)}%]
                </Typography>
              )}
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                K₂U 30-day forecast
              </Typography>
              <Typography variant="body1">
                {prediction.k2u_forecast !== undefined && prediction.k2u_forecast !== null
                  ? `${Number(prediction.k2u_forecast).toFixed(2)}%`
                  : '—'}
              </Typography>
            </Box>

            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="caption" color="text.secondary">
                Balancer need
              </Typography>
              {(() => {
                const info = BALANCER_NEED[prediction.balancer_need];
                if (!info) {
                  return (
                    <Chip
                      label="—"
                      size="small"
                      sx={{ bgcolor: 'grey.400', color: 'common.white' }}
                    />
                  );
                }
                return (
                  <Chip
                    label={info.label}
                    size="small"
                    sx={{ bgcolor: info.color, color: 'common.white', fontWeight: 600 }}
                  />
                );
              })()}
            </Stack>

            {prediction.balancer_need && prediction.balancer_need !== 'none' && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Payback
                </Typography>
                <Typography variant="body1">
                  {prediction.payback !== undefined && prediction.payback !== null
                    ? `${Number(prediction.payback).toFixed(1)} years`
                    : '—'}
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
