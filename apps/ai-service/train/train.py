"""
Train the RUL model + CQR interval + decision layer, and save serving artifacts.

Reproduces the Scopus paper pipeline (`sim_train.py` + `sim_cqr.py`):
  - temporal split (train past, test future) to avoid leakage
  - XGBoost regressor with a small temporal-CV hyperparameter search
  - baselines (RandomForest, Linear, PhysicsOnly, XGB-no-physics)
  - quantile models q10/q90 + conformal calibration (qhat) for 80% intervals
  - three-level balancer decision layer

Artifacts -> apps/ai-service/artifacts/: xgb_rul.json, xgb_q10.json, xgb_q90.json,
meta.json (feats, qhat, best_params, metrics, decision thresholds).

Run:  python train/train.py [--data data/rul_dataset.csv]
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, confusion_matrix

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.features import FEATS, TARGET  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "artifacts")


def evl(y, yh):
    return dict(
        RMSE=float(np.sqrt(mean_squared_error(y, yh))),
        MAE=float(mean_absolute_error(y, yh)),
        R2=float(r2_score(y, yh)),
    )


def dlevel(k2u_p95, rul):
    """Three-level balancer need (paper §4.6)."""
    if (k2u_p95 >= 4.0) and (rul <= 0.30):
        return 2  # required
    if (k2u_p95 >= 2.0) and (rul <= 0.50):
        return 1  # recommended
    return 0      # none


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "..", "data", "rul_dataset.csv"))
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    df["is_pv"] = (df.device_type == "pv_inverter").astype(int)

    # temporal split: train on first 70% of calendar time, test on last 30%
    tsplit = df["cal_date"].quantile(0.70)
    tr, te = df[df.cal_date <= tsplit], df[df.cal_date > tsplit]
    Xtr, ytr, Xte, yte = tr[FEATS], tr[TARGET], te[FEATS], te[TARGET]
    res = {"n_train": int(len(tr)), "n_test": int(len(te)), "split_at_years": float(tsplit)}

    # inner temporal CV for XGBoost hyperparameters
    tcv = tr["cal_date"].quantile(0.8)
    itr, iva = tr[tr.cal_date <= tcv], tr[tr.cal_date > tcv]
    best, best_rmse = None, 1e9
    for md in [4, 6]:
        for lr_ in [0.06, 0.1]:
            mdl = xgb.XGBRegressor(tree_method="hist", max_depth=md, learning_rate=lr_,
                                   n_estimators=600, subsample=0.9, colsample_bytree=0.9,
                                   reg_lambda=1.0, early_stopping_rounds=50, n_jobs=4, random_state=0)
            mdl.fit(itr[FEATS], itr[TARGET], eval_set=[(iva[FEATS], iva[TARGET])], verbose=False)
            r = np.sqrt(mean_squared_error(iva[TARGET], mdl.predict(iva[FEATS])))
            if r < best_rmse:
                best_rmse, best = r, dict(max_depth=md, learning_rate=lr_, n_estimators=int(mdl.best_iteration + 1))
    res["xgb_best_params"] = best

    common = dict(tree_method="hist", subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0, n_jobs=4, random_state=0)
    xgbm = xgb.XGBRegressor(**best, **common)
    xgbm.fit(Xtr, ytr)
    t0 = time.perf_counter(); _ = xgbm.predict(Xte); t1 = time.perf_counter()
    res["xgb_inference_us_per_sample"] = (t1 - t0) / max(1, len(Xte)) * 1e6
    res["XGBoost"] = evl(yte, xgbm.predict(Xte))

    # baselines
    rf = RandomForestRegressor(n_estimators=300, min_samples_leaf=2, n_jobs=4, random_state=0).fit(Xtr, ytr)
    res["RandomForest"] = evl(yte, rf.predict(Xte))
    res["Linear"] = evl(yte, LinearRegression().fit(Xtr, ytr).predict(Xte))
    rate = (te["cum_damage_index"] / te["service_age"]).clip(1e-4)
    phys = (((1 - te["cum_damage_index"]).clip(0) / rate) / np.where(te.is_pv == 1, 12.0, 15.0)).clip(0, 2.5)
    res["PhysicsOnly"] = evl(yte, phys)
    F2 = [f for f in FEATS if f != "cum_damage_index"]
    res["XGB_noPhysics"] = evl(yte, xgb.XGBRegressor(**best, **common).fit(Xtr[F2], ytr).predict(Xte[F2]))
    for dt, name in [(1, "pv"), (0, "telecom")]:
        m = te.is_pv == dt
        if m.any():
            res[f"XGB_{name}"] = evl(yte[m], xgbm.predict(Xte[m]))

    imp = xgbm.get_booster().get_score(importance_type="gain")
    tot = sum(imp.values()) or 1.0
    res["feature_importance"] = {k: v / tot for k, v in sorted(imp.items(), key=lambda x: -x[1])}

    # ---- quantile models + conformal calibration (CQR, 80% target) ----
    t56 = tr["cal_date"].quantile(0.8)
    ptr, cal = tr[tr.cal_date <= t56], tr[tr.cal_date > t56]
    qkw = dict(objective="reg:quantileerror", **best, **common)
    q10 = xgb.XGBRegressor(quantile_alpha=0.1, **qkw).fit(ptr[FEATS], ptr[TARGET])
    q90 = xgb.XGBRegressor(quantile_alpha=0.9, **qkw).fit(ptr[FEATS], ptr[TARGET])
    lo_c, hi_c = q10.predict(cal[FEATS]), q90.predict(cal[FEATS])
    E = np.maximum(lo_c - cal[TARGET].values, cal[TARGET].values - hi_c)
    n = len(E)
    qhat = float(np.quantile(E, min(np.ceil((n + 1) * 0.9) / n, 1.0)))
    lo_t = np.clip(q10.predict(Xte) - qhat, 0, None)
    hi_t = q90.predict(Xte) + qhat
    res["qhat"] = qhat
    res["cqr_coverage_before"] = float(((yte >= q10.predict(Xte)) & (yte <= q90.predict(Xte))).mean())
    res["cqr_coverage_after"] = float(((yte >= lo_t) & (yte <= hi_t)).mean())
    res["cqr_width_after"] = float((hi_t - lo_t).mean())

    # ---- decision layer ----
    rul_hat = xgbm.predict(Xte)
    lvl_true = [dlevel(k, r) for k, r in zip(te.k2u_p95_30d, te.rul_rel)]
    lvl_pred = [dlevel(k, r) for k, r in zip(te.k2u_p95_30d, rul_hat)]
    res["decision_accuracy"] = float(accuracy_score(lvl_true, lvl_pred))
    res["decision_confusion"] = confusion_matrix(lvl_true, lvl_pred, labels=[0, 1, 2]).tolist()
    req = np.array(lvl_true) == 2
    res["required_detected_1or2"] = float((np.array(lvl_pred)[req] >= 1).mean()) if req.any() else 0.0

    # ---- save artifacts ----
    os.makedirs(ART, exist_ok=True)
    xgbm.save_model(os.path.join(ART, "xgb_rul.json"))
    q10.save_model(os.path.join(ART, "xgb_q10.json"))
    q90.save_model(os.path.join(ART, "xgb_q90.json"))
    meta = {
        "feats": FEATS, "qhat": qhat, "best_params": best,
        "decision_thresholds": {"required": {"k2u_p95": 4.0, "rul": 0.30},
                                 "recommended": {"k2u_p95": 2.0, "rul": 0.50}},
        "metrics": {k: res[k] for k in ["XGBoost", "RandomForest", "Linear", "PhysicsOnly",
                                        "XGB_noPhysics", "decision_accuracy", "qhat",
                                        "cqr_coverage_after"] if k in res},
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(os.path.join(ART, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    with open(os.path.join(ART, "train_report.json"), "w") as f:
        json.dump(res, f, indent=2)
    print(json.dumps({k: res[k] for k in ["XGBoost", "XGB_pv", "XGB_telecom", "XGB_noPhysics",
                                          "qhat", "cqr_coverage_after", "decision_accuracy"] if k in res}, indent=2))


if __name__ == "__main__":
    main()
