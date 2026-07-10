#pragma once
// Hardware-independent K2U math (no Arduino deps) so it can be unit-tested on
// the host (pio test -e native) and stays identical to packages/k2u-core.

namespace k2u {

enum Status { NORMAL = 0, WARNING = 1, CRITICAL = 2 };

// IEC 61000-4-30 RMS-only negative-sequence unbalance factor, percent.
// Inputs are line-to-line voltage magnitudes.
float beta_method(float uab, float ubc, float uca);

// Reconstruct line-voltage magnitudes from the three phase-neutral RMS
// magnitudes assuming nominal 120-degree phase spacing (a magnitudes-only
// device cannot measure the true angles). Matches the paper's device chain.
void line_from_phase_nominal(float ua, float ub, float uc,
                             float* uab, float* ubc, float* uca);

// GOST 32144-2013 classification against the 2% / 4% limits.
Status classify(float k2u_pct);

const char* status_name(Status s);

}  // namespace k2u
