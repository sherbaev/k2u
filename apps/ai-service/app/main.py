"""FastAPI RUL service. The NestJS backend feeds engineered features here and
stores the returned RUL + interval + balancer decision."""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .features import FEATS
from .model import get_model

app = FastAPI(title="K2U RUL Service", version="0.1.0")


class Features(BaseModel):
    # The 15 model features (paper Table 4.1). device_type is accepted as an
    # alternative to is_pv.
    k2u_mean_7d: float = 0.0
    k2u_mean_30d: float = 0.0
    k2u_p95_7d: float = 0.0
    k2u_p95_30d: float = 0.0
    k2u_max_30d: float = 0.0
    exposure_2pct_30d: float = 0.0
    exposure_4pct_30d: float = 0.0
    cum_damage_index: float = 0.0
    temp_mean_30d: float = 0.0
    temp_max_30d: float = 0.0
    load_factor_mean_30d: float = 0.0
    thermal_cycles_30d: float = 0.0
    is_pv: Optional[int] = None
    service_age: float = 1.0
    rated_power: float = 5.0
    device_type: Optional[str] = None
    siteId: Optional[str] = None
    devId: Optional[str] = None


class PredictRequest(BaseModel):
    items: list[Features] = Field(default_factory=list)


@app.get("/health")
def health():
    m = get_model()
    return {"status": "ok", "model_loaded": m.loaded, "qhat": m.qhat, "features": FEATS}


@app.post("/predict")
def predict(req: PredictRequest):
    m = get_model()
    out = []
    for it in req.items:
        row = it.model_dump()
        pred = m.predict(row)
        if it.siteId:
            pred["siteId"] = it.siteId
        if it.devId:
            pred["devId"] = it.devId
        out.append(pred)
    return {"predictions": out}
