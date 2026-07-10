import { Box, Stack, Typography } from "@mui/material";

/**
 * Consistent page header: icon in a soft tinted tile, title, subtitle, and
 * an optional right-aligned actions slot. Used at the top of every page for
 * a cohesive, "finished product" look across the app.
 */
export default function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Stack direction="row" spacing={1.75} alignItems="center">
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "primary.main",
              backgroundImage: "linear-gradient(135deg, #155e9c, #0f8b8d)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && <Box>{actions}</Box>}
    </Stack>
  );
}
