import React from 'react';
import { Chip } from '@mui/material';

const STATUS_COLORS = {
  NORMAL: '#2e7d32',
  WARNING: '#ed6c02',
  CRITICAL: '#d32f2f',
};

const STATUS_LABELS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
};

export default function StatusBadge({ status, size = 'small' }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status] || '—';

  if (!color) {
    return (
      <Chip
        label={label}
        size={size}
        sx={{
          bgcolor: 'grey.400',
          color: 'common.white',
          fontWeight: 600,
        }}
      />
    );
  }

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: color,
        color: 'common.white',
        fontWeight: 600,
      }}
    />
  );
}
