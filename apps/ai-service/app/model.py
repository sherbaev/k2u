"""RUL model loader + inference (point estimate + conformal CQR interval)."""
from __future__ import annotations

import json
import os
from typing import Optional

import numpy as np

from .features import FEATS, row_to_vector
from . import decision as dec

ART = os.path.join(os.path.dirname(__file__), "..", "artifacts")


class RulModel:
    """Loads the trained XGBoost RUL + quantile models and serves predictions.

    Falls back to a physics-only estimate when artifacts are absent, so the
    service is usable before the first training run.
    """

    def __init__(self, art_dir: str = ART):
        self.loaded = False
        self.qhat = 0.0
        self.thresholds = {"required": dec.REQUIRED, "recommended": dec.RECOMMENDED}
        self._m = self._q10 = self._q90 = None
        try:
            import xgboost as xgb  # local import so fallback works without xgboost
            meta_path = os.path.join(art_dir, "meta.json")
            if os.path.exists(meta_path):
                with open(meta_path) as f:
                    meta = json.load(f)
                self.qhat = float(meta.get("qhat", 0.0))
                self.thresholds = meta.get("decision_thresholds", self.thresholds)
                self._m = xgb.XGBRegressor()
                self._m.load_model(os.path.join(art_dir, "xgb_rul.json"))
                self._q10 = xgb.XGBRegressor(); self._q10.load_model(os.path.join(art_dir, "xgb_q10.json"))
                self._q90 = xgb.XGBRegressor(); self._q90.load_model(os.path.join(art_dir, "xgb_q90.json"))
                self.loaded = True
        except Exception:
            self.loaded = False

    def predict(self, feature_row: dict) -> dict:
        vec = np.array([row_to_vector(feature_row)], dtype=float)
        if self.loaded and self._m is not None:
            rul = float(np.clip(self._m.predict(vec)[0], 0, None))
            lo = float(np.clip(self._q10.predict(vec)[0] - self.qhat, 0, None))
            hi = float(self._q90.predict(vec)[0] + self.qhat)
        else:
            rul = self._physics_fallback(feature_row)
            lo, hi = max(rul - 0.25, 0.0), rul + 0.25

        k2u_p95 = float(feature_row.get("k2u_p95_30d", 0.0))
        k2u_mean = float(feature_row.get("k2u_mean_30d", 0.0))
        rated = float(feature_row.get("rated_power", 0.0))
        level = dec.decide(k2u_p95, rul, self.thresholds["required"], self.thresholds["recommended"])
        return {
            "rul": round(rul, 4),
            "rul_lo": round(lo, 4),
            "rul_hi": round(hi, 4),
            "k2u_forecast": round(k2u_p95, 2),  # simple persistence forecast of the 30d p95
            "balancer_need": dec.LEVELS[level],
            "payback": dec.payback_years(level, rated, k2u_mean),
            "source": "model" if self.loaded else "physics_fallback",
        }

    @staticmethod
    def _physics_fallback(r: dict) -> float:
        cd = float(r.get("cum_damage_index", 0.0))
        age = max(float(r.get("service_age", 1.0)), 0.2)
        is_pv = 1 if (r.get("is_pv", 0) or r.get("device_type") == "pv_inverter") else 0
        rate = max(cd / age, 1e-4)
        life = 12.0 if is_pv else 15.0
        return float(np.clip((max(1 - cd, 0.0) / rate) / life, 0, 2.5))


_MODEL: Optional[RulModel] = None


def get_model() -> RulModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = RulModel()
    return _MODEL
