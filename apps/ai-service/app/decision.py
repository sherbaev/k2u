"""Balancer-need decision layer + economic payback (paper §4.6).

Advisory only — the platform recommends, it does not actuate a balancer.
"""
from __future__ import annotations

# Default thresholds (overridden by artifacts/meta.json when present).
REQUIRED = {"k2u_p95": 4.0, "rul": 0.30}
RECOMMENDED = {"k2u_p95": 2.0, "rul": 0.50}

LEVELS = {0: "none", 1: "recommended", 2: "required"}


def decide(k2u_p95_30d: float, rul: float,
           required=REQUIRED, recommended=RECOMMENDED) -> int:
    """Return 0=none, 1=recommended, 2=required."""
    if k2u_p95_30d >= required["k2u_p95"] and rul <= required["rul"]:
        return 2
    if k2u_p95_30d >= recommended["k2u_p95"] and rul <= recommended["rul"]:
        return 1
    return 0


def unbalance_life_reduction(k2u_mean_30d: float, k_unb: float = 1.4) -> float:
    """Fraction of life lost to unbalance heating (Montsinger): 1 - 2^(-ΔT/10)."""
    dT = k_unb * (k2u_mean_30d ** 2)
    return 1.0 - 2.0 ** (-dT / 10.0)


def payback_years(level: int, rated_power_kw: float, k2u_mean_30d: float,
                  balancer_cost_per_kw: float = 60.0, energy_price: float = 0.08,
                  loss_fraction_of_rating: float = 0.02) -> float | None:
    """Rough payback: balancer capex vs. annual value of avoided losses/aging.

    Illustrative (paper gives an economic *illustration*, not a costing tool):
    annual saving ≈ rated_power · loss_fraction · life_reduction · 8760h · price.
    """
    if level == 0:
        return None
    capex = balancer_cost_per_kw * max(rated_power_kw, 0.1)
    red = unbalance_life_reduction(k2u_mean_30d)
    annual_saving = rated_power_kw * loss_fraction_of_rating * red * 8760.0 * energy_price
    if annual_saving <= 1e-6:
        return None
    return round(capex / annual_saving, 1)
