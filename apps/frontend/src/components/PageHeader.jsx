import { Box, Stack, Typography } from "@mui/material";

/**
 * Consistent page header: icon in a soft tinted tile, title, subtitle, and
 * an optional right-aligned actions slot. Used at the top of every page for
 * a cohesive, "finished product" look across the app.
 */
export default function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "stretch", md: "center" }}
      justifyContent="space-between"
      spacing={{ xs: 1.5, md: 2 }}
      sx={{ mb: 3, minWidth: 0 }}
    >
      <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
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
        <Box sx={{ minWidth: 0 }}>
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
      {actions && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1.5,
            width: { xs: "100%", md: "auto" },
            "& > *": { minWidth: 0 },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}
