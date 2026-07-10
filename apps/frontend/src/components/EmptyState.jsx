import { Box, Stack, Typography, Button } from "@mui/material";

/**
 * Reusable empty-state block for lists/tables with nothing to show yet.
 * Keeps loading/empty UX consistent with a friendly icon + message +
 * optional call-to-action button.
 */
export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 2, textAlign: "center" }}>
      {icon && (
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            color: "text.secondary",
            mb: 0.5,
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" size="small" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
