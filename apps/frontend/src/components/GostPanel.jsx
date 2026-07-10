import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Box,
} from '@mui/material';

function percentile(values, p) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

function humanDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

const VERDICT_COLORS = {
  PASS: '#2e7d32',
  MARGINAL: '#ed6c02',
  FAIL: '#d32f2f',
};

export default function GostPanel({ aggregates }) {
  const stats = useMemo(() => {
    if (!Array.isArray(aggregates) || aggregates.length === 0) return null;

    const p95Values = aggregates
      .map((a) => a.k2u_p95)
      .filter((v) => v !== undefined && v !== null && !Number.isNaN(v));

    const avgValues = aggregates
      .map((a) => a.k2u_avg)
      .filter((v) => v !== undefined && v !== null && !Number.isNaN(v));

    const source = p95Values.length > 0 ? p95Values : avgValues;
    const weeklyP95 = percentile(source, 95);

    const exceed2 = aggregates.reduce(
      (sum, a) => sum + (Number(a.exceed_2pct_s) || 0),
      0
    );
    const exceed4 = aggregates.reduce(
      (sum, a) => sum + (Number(a.exceed_4pct_s) || 0),
      0
    );

    let verdict = 'PASS';
    if (weeklyP95 !== null) {
      if (weeklyP95 > 4) verdict = 'FAIL';
      else if (weeklyP95 > 2) verdict = 'MARGINAL';
      else verdict = 'PASS';
    }

    return { weeklyP95, exceed2, exceed4, verdict };
  }, [aggregates]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          GOST 32144-2013 compliance (weekly)
        </Typography>

        {!stats ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No aggregate data available.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Verdict
              </Typography>
              <Chip
                label={stats.verdict}
                sx={{
                  bgcolor: VERDICT_COLORS[stats.verdict],
                  color: 'common.white',
                  fontWeight: 600,
                }}
              />
            </Stack>

            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Weekly K₂U p95</TableCell>
                  <TableCell align="right">
                    {stats.weeklyP95 !== null ? `${stats.weeklyP95.toFixed(2)}%` : '—'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Time exceeding 2% (normal limit)</TableCell>
                  <TableCell align="right">{humanDuration(stats.exceed2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Time exceeding 4% (max limit)</TableCell>
                  <TableCell align="right">{humanDuration(stats.exceed4)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
