#include "k2u.h"
#include <math.h>

namespace k2u {

float beta_method(float uab, float ubc, float uca) {
  if (!(uab > 0.0f) || !(ubc > 0.0f) || !(uca > 0.0f)) return NAN;
  const float s2 = uab * uab + ubc * ubc + uca * uca;
  const float s4 = uab * uab * uab * uab + ubc * ubc * ubc * ubc + uca * uca * uca * uca;
  float beta = s4 / (s2 * s2);
  // Clamp to the valid domain [1/3, 1/2) to guard float noise.
  const float lo = 1.0f / 3.0f;
  const float hi = 0.5f - 1e-9f;
  if (beta < lo) beta = lo;
  if (beta >= 0.5f) beta = hi;
  const float root = sqrtf(3.0f - 6.0f * beta);
  return sqrtf((1.0f - root) / (1.0f + root)) * 100.0f;
}

void line_from_phase_nominal(float ua, float ub, float uc,
                             float* uab, float* ubc, float* uca) {
  // Phasors at nominal angles 0, -120, +120 degrees.
  const float d2r = 3.14159265358979323846f / 180.0f;
  const float ax = ua, ay = 0.0f;
  const float bx = ub * cosf(-120.0f * d2r), by = ub * sinf(-120.0f * d2r);
  const float cx = uc * cosf(120.0f * d2r), cy = uc * sinf(120.0f * d2r);
  *uab = hypotf(ax - bx, ay - by);
  *ubc = hypotf(bx - cx, by - cy);
  *uca = hypotf(cx - ax, cy - ay);
}

Status classify(float k2u_pct) {
  if (k2u_pct <= 2.0f) return NORMAL;
  if (k2u_pct <= 4.0f) return WARNING;
  return CRITICAL;
}

const char* status_name(Status s) {
  switch (s) {
    case NORMAL: return "NORMAL";
    case WARNING: return "WARNING";
    default: return "CRITICAL";
  }
}

}  // namespace k2u
