import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Box,
} from '@mui/material';
import { format } from 'date-fns';
import StatusBadge from './StatusBadge.jsx';

function fmtTime(ts) {
  try {
    return format(new Date(ts), 'MMM d HH:mm:ss');
  } catch (e) {
    return '—';
  }
}

function fmtK2u(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

export default function AlertsPanel({ events, onAck }) {
  const hasEvents = Array.isArray(events) && events.length > 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Alerts
        </Typography>

        {!hasEvents ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No alerts
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>K₂U</TableCell>
                <TableCell align="right">Ack</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event, idx) => (
                <TableRow key={`${event.devId || 'dev'}-${event.ts || idx}-${idx}`}>
                  <TableCell>{fmtTime(event.ts)}</TableCell>
                  <TableCell>{event.devId || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={event.type} />
                  </TableCell>
                  <TableCell>{fmtK2u(event.k2u)}</TableCell>
                  <TableCell align="right">
                    {event.ackAt ? (
                      <Typography variant="body2" color="success.main">
                        ✓ acked
                      </Typography>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onAck && onAck(event)}
                      >
                        Ack
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
