# ai-service — RUL prediction + balancer decision

FastAPI microservice implementing the paper's RUL pipeline (BOB IV): XGBoost
regressor on 15 unbalance/thermal features, conformalized quantile-regression
(CQR) intervals, and a three-level balancer-need decision layer. The NestJS
backend feeds engineered features and stores the returned predictions.

## Train (produces the serving artifacts)

```bash
pip install -r requirements.txt
python train/generate.py --pv 260 --tc 260     # physics fleet -> data/rul_dataset.csv
python train/train.py                          # -> artifacts/{xgb_rul,xgb_q10,xgb_q90,meta}.json
```

`train.py` reproduces the paper metrics: XGBoost R²≈0.76 (PV≈0.72, telecom≈0.79),
the physics-ablation drop (R²≈0.15 without `cum_damage_index`), CQR `qhat`≈0.07,
and decision accuracy≈0.95. See `artifacts/train_report.json` after a run.

## Serve

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- `GET /health` → `{status, model_loaded, qhat, features}`
- `POST /predict` → body `{ "items": [ {<15 features>, siteId, devId} ] }`,
  returns `rul`, `rul_lo/hi` (CQR interval), `k2u_forecast`, `balancer_need`
  (none/recommended/required), `payback`.

If no artifacts are present the service still answers using a physics-only
fallback (`source: "physics_fallback"`), so the platform runs before training.

## Notes

- Physics model: Miner's rule + Montsinger/Arrhenius thermal life with unbalance
  heating ∝ k·K₂U². It both generates synthetic training trajectories and supplies
  the dominant `cum_damage_index` feature.
- Temporal train/test split (train past, test future) prevents leakage.
- Deployed internal-only on Coolify; only the backend calls it.
