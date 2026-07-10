import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

export default function VoltageChart({ history }) {
  const data = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    return [...history]
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((doc) => ({
        ts: doc.ts,
        timeLabel: (() => {
          try {
            return format(new Date(doc.ts), 'HH:mm');
          } catch (e) {
            return '';
          }
        })(),
        u_a: doc.u_a,
        u_b: doc.u_b,
        u_c: doc.u_c,
        k2u: doc.k2u,
      }));
  }, [history]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Voltages &amp; K₂U (recent)
        </Typography>

        {data.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No voltage history available.
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeLabel" />
              <YAxis yAxisId="voltage" label={{ value: 'V', angle: -90, position: 'insideLeft' }} />
              <YAxis
                yAxisId="k2u"
                orientation="right"
                label={{ value: 'K₂U %', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="voltage"
                type="monotone"
                dataKey="u_a"
                name="U_A"
                stroke="#1976d2"
                strokeWidth={1}
                dot={false}
              />
              <Line
                yAxisId="voltage"
                type="monotone"
                dataKey="u_b"
                name="U_B"
                stroke="#9c27b0"
                strokeWidth={1}
                dot={false}
              />
              <Line
                yAxisId="voltage"
                type="monotone"
                dataKey="u_c"
                name="U_C"
                stroke="#00897b"
                strokeWidth={1}
                dot={false}
              />
              <Line
                yAxisId="k2u"
                type="monotone"
                dataKey="k2u"
                name="K₂U"
                stroke="#d32f2f"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
