// Native unit tests for the hardware-independent K2U math (pio test -e native).
#include <unity.h>
#include <math.h>
#include "k2u.h"

void test_balanced_is_zero() {
  float uab, ubc, uca;
  k2u::line_from_phase_nominal(220.0f, 220.0f, 220.0f, &uab, &ubc, &uca);
  float k = k2u::beta_method(uab, ubc, uca);
  TEST_ASSERT_FLOAT_WITHIN(1e-3f, 0.0f, k);
  TEST_ASSERT_EQUAL(k2u::NORMAL, k2u::classify(k));
}

void test_balanced_line_magnitude() {
  float uab, ubc, uca;
  k2u::line_from_phase_nominal(220.0f, 220.0f, 220.0f, &uab, &ubc, &uca);
  // 220 * sqrt(3) ~= 381.05
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 381.05f, uab);
}

void test_known_unbalance_direct_line() {
  // A 2% synthetic line-voltage set (eps=0.02) generated offline; beta method
  // must return ~2%.  U = 1 + 2*eps*cos(theta - phase) at theta=0.
  float k = k2u::beta_method(1.02f, 0.99f, 0.99f);
  TEST_ASSERT_TRUE(k > 0.5f && k < 3.5f);
}

void test_classify_boundaries() {
  TEST_ASSERT_EQUAL(k2u::NORMAL, k2u::classify(2.0f));
  TEST_ASSERT_EQUAL(k2u::WARNING, k2u::classify(3.0f));
  TEST_ASSERT_EQUAL(k2u::CRITICAL, k2u::classify(4.01f));
}

void test_degenerate_returns_nan() {
  float k = k2u::beta_method(-1.0f, 220.0f, 220.0f);
  TEST_ASSERT_TRUE(isnan(k));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_balanced_is_zero);
  RUN_TEST(test_balanced_line_magnitude);
  RUN_TEST(test_known_unbalance_direct_line);
  RUN_TEST(test_classify_boundaries);
  RUN_TEST(test_degenerate_returns_nan);
  return UNITY_END();
}
