"""Feature contract for the RUL model — the 15 inputs from the paper (Table 4.1).

Kept in one place so the training pipeline and the serving path agree exactly.
"""
from __future__ import annotations

# Order matters: model matrices are built in this order.
FEATS = [
    "k2u_mean_7d", "k2u_mean_30d", "k2u_p95_7d", "k2u_p95_30d", "k2u_max_30d",
    "exposure_2pct_30d", "exposure_4pct_30d", "cum_damage_index",
    "temp_mean_30d", "temp_max_30d", "load_factor_mean_30d", "thermal_cycles_30d",
    "is_pv", "service_age", "rated_power",
]

TARGET = "rul_rel"


def row_to_vector(row: dict) -> list[float]:
    """Build the ordered feature vector from a feature dict.

    `device_type` ("pv_inverter"/"telecom_rect") is accepted and converted to
    the `is_pv` flag if `is_pv` is not already provided.
    """
    r = dict(row)
    if "is_pv" not in r and "device_type" in r:
        r["is_pv"] = 1 if r["device_type"] == "pv_inverter" else 0
    return [float(r.get(f, 0.0)) for f in FEATS]
