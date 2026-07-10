"""
Physics-based fleet degradation data generator for RUL training.

Adapted from the Scopus paper's `sim_generate.py` (Part B). Produces
`rul_dataset.csv` used by `train.py`. The physics model (Miner's rule +
Montsinger/Arrhenius thermal life, unbalance heating ~ k·K2U^2) both generates
synthetic aging trajectories and provides the `cum_damage_index` physics
feature — the single most important predictor in the paper.

Run:  python train/generate.py [--pv 260 --tc 260 --out data/rul_dataset.csv]
"""
import argparse
import json
import os
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
H = 8760  # hourly, one representative tiled year
T_REF = 40.0  # hotspot at which nominal life is reached

PARAMS = {
    "pv_inverter": dict(L_nom_h=12 * 8760.0, k_unb=1.6),   # DC-link electrolytic caps
    "telecom_rect": dict(L_nom_h=15 * 8760.0, k_unb=1.2),  # rectifier + HVAC motor mix
}


def simulate_fleet(n_units, device_type, rng):
    doy = np.arange(H) / 24.0
    units = []
    for _ in range(n_units):
        base = min(rng.lognormal(mean=np.log(1.2), sigma=0.55), 5.0)
        daily_amp = rng.uniform(0.1, 0.6) * base
        weekly_amp = rng.uniform(0.0, 0.25) * base
        noise_sig = rng.uniform(0.08, 0.30) * base
        phi = 0.9
        e = rng.normal(0, noise_sig * np.sqrt(1 - phi**2), H)
        n = np.empty(H)
        n[0] = 0
        for k in range(1, H):
            n[k] = phi * n[k - 1] + e[k]
        k2u = (
            base
            + daily_amp * np.sin(2 * np.pi * (doy % 1.0) + rng.uniform(0, 2 * np.pi))
            + weekly_amp * np.sin(2 * np.pi * (doy % 7.0) / 7.0)
            + n
        )
        for _ in range(rng.poisson(8)):
            s = rng.integers(0, H - 72)
            d = rng.integers(4, 72)
            k2u[s:s + d] += rng.uniform(0.5, 2.5)
        k2u = np.clip(k2u, 0.05, 8.0)

        if device_type == "pv_inverter":
            T_amb = 16 + 14 * np.sin(2 * np.pi * (doy - 100) / 365) + 8 * np.sin(2 * np.pi * (doy % 1.0) - np.pi / 2)
            load = np.clip(np.sin(np.pi * ((doy % 1.0) * 24 - 6) / 12), 0, None) * rng.uniform(0.6, 0.95)
            dT_load_max = 22.0
        else:
            T_amb = 18 + 10 * np.sin(2 * np.pi * (doy - 100) / 365) + 5 * np.sin(2 * np.pi * (doy % 1.0) - np.pi / 2)
            load = rng.uniform(0.45, 0.8) + 0.08 * np.sin(2 * np.pi * (doy % 1.0)) + rng.normal(0, 0.02, H)
            load = np.clip(load, 0.2, 1.0)
            dT_load_max = 18.0
        units.append(dict(
            k2u=k2u, T_amb=T_amb, load=load, dT_load_max=dT_load_max, base=base,
            device_type=device_type, rated_power=float(rng.choice([3, 5, 10, 15, 20])),
            quality=rng.lognormal(0, 0.18),
        ))
    return units


def damage_rate(k2u, T_amb, load, dT_load_max, L_nom_h, k_unb, hidden_stress=1.0):
    """Hourly damage increment (Miner + Montsinger halving per +10 °C)."""
    T_hot = T_amb + dT_load_max * load**2 + k_unb * k2u**2 * hidden_stress
    L = L_nom_h * 2.0 ** ((T_REF - T_hot) / 10.0)
    return 1.0 / L


def build_dataset(units, rng):
    rows = []
    for u in units:
        p = PARAMS[u["device_type"]]
        hidden = rng.lognormal(0, 0.12)
        annual_D = damage_rate(u["k2u"], u["T_amb"], u["load"], u["dT_load_max"], p["L_nom_h"], p["k_unb"], hidden).sum()
        annual_D_nom = damage_rate(u["k2u"], u["T_amb"], u["load"], u["dT_load_max"], p["L_nom_h"], p["k_unb"], 1.0).sum()
        D_fail = u["quality"]
        year_mult = np.cumprod(1 + rng.normal(0.02, 0.05, 40))
        cumD, t_fail = 0.0, None
        for y in range(40):
            dy = annual_D * year_mult[y]
            if cumD + dy >= D_fail:
                t_fail = y + (D_fail - cumD) / dy
                break
            cumD += dy
        if t_fail is None:
            t_fail = 40.0
        L_nom_years = p["L_nom_h"] / 8760.0

        obs_times = np.arange(0.2, min(t_fail, 25.0), 60 / 365.0)
        if len(obs_times) > 40:
            obs_times = rng.choice(obs_times, 40, replace=False)
        for t_obs in obs_times:
            h_obs = int((t_obs % 1.0) * (H - 1))
            w7 = slice(max(0, h_obs - 168), h_obs) if h_obs > 200 else slice(0, 168)
            w30 = slice(max(0, h_obs - 720), h_obs) if h_obs > 800 else slice(0, 720)
            k7, k30 = u["k2u"][w7], u["k2u"][w30]
            T30 = (u["T_amb"] + u["dT_load_max"] * u["load"]**2)[w30]
            ld30 = u["load"][w30]
            Td = T30[:len(T30) // 24 * 24].reshape(-1, 24) if len(T30) >= 24 else T30.reshape(1, -1)
            cyc = int((Td.max(1) - Td.min(1) > 15).sum())
            yfull = int(t_obs)
            if yfull > 0:
                cd = annual_D_nom * year_mult[:yfull].sum() + annual_D_nom * year_mult[yfull] * (t_obs - yfull)
            else:
                cd = annual_D_nom * year_mult[0] * t_obs
            rows.append(dict(
                k2u_mean_7d=k7.mean(), k2u_mean_30d=k30.mean(),
                k2u_p95_7d=np.percentile(k7, 95), k2u_p95_30d=np.percentile(k30, 95),
                k2u_max_30d=k30.max(),
                exposure_2pct_30d=float((k30 >= 2).sum()),
                exposure_4pct_30d=float((k30 >= 4).sum()),
                cum_damage_index=min(cd, 3.0),
                temp_mean_30d=T30.mean(), temp_max_30d=T30.max(),
                load_factor_mean_30d=ld30.mean(), thermal_cycles_30d=cyc,
                device_type=u["device_type"], service_age=t_obs,
                rated_power=u["rated_power"],
                rul_rel=min(max(t_fail - t_obs, 0.0) / L_nom_years, 2.5),
                t_fail=t_fail, base_k2u=u["base"],
            ))
    return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pv", type=int, default=260)
    ap.add_argument("--tc", type=int, default=260)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "rul_dataset.csv"))
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)

    fleet = simulate_fleet(args.pv, "pv_inverter", rng) + simulate_fleet(args.tc, "telecom_rect", rng)
    df = build_dataset(fleet, rng)
    df["unit_id"] = df.groupby(["t_fail", "base_k2u"]).ngroup()
    start_map = {uid: rng.uniform(0, 3) for uid in df["unit_id"].unique()}
    df["cal_date"] = df["unit_id"].map(start_map) + df["service_age"]

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    df.to_csv(args.out, index=False)
    summary = {
        "n_units": len(fleet), "n_obs": len(df),
        "median_t_fail_pv": float(df[df.device_type == "pv_inverter"]["t_fail"].median()),
        "median_t_fail_tc": float(df[df.device_type == "telecom_rect"]["t_fail"].median()),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
