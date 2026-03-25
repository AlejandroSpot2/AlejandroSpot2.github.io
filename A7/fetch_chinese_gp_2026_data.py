from pathlib import Path

import fastf1
import pandas as pd


ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / ".fastf1_cache"
SUMMARY_CSV = ROOT / "chinese_2026_driver_summary.csv"
LAPS_CSV = ROOT / "chinese_2026_lap_positions.csv"


def to_seconds(series: pd.Series) -> pd.Series:
    return pd.to_timedelta(series, errors="coerce").dt.total_seconds()


CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

session = fastf1.get_session(2026, "Chinese Grand Prix", "R")
session.load()

results = session.results.copy()
laps = session.laps.copy()

laps["LapNumber"] = pd.to_numeric(laps["LapNumber"], errors="coerce")
laps["Position"] = pd.to_numeric(laps["Position"], errors="coerce")
laps["TyreLife"] = pd.to_numeric(laps["TyreLife"], errors="coerce")
laps["SpeedST"] = pd.to_numeric(laps["SpeedST"], errors="coerce")
laps["LapTimeSec"] = to_seconds(laps["LapTime"])

lap_summary = (
    laps.dropna(subset=["Driver", "LapNumber"])
    .groupby(["Driver", "Team"], as_index=False)
    .agg(
        LapsOnRecord=("LapNumber", "count"),
        AvgLapTimeSec=("LapTimeSec", "mean"),
        FastestLapTimeSec=("LapTimeSec", "min"),
        AvgSpeedST=("SpeedST", "mean"),
    )
)

summary = results.rename(
    columns={
        "Abbreviation": "Driver",
        "TeamName": "Team",
    }
).copy()

for column in ["GridPosition", "Position", "Points", "Laps"]:
    summary[column] = pd.to_numeric(summary[column], errors="coerce")

summary["PositionsGained"] = summary["GridPosition"] - summary["Position"]

summary = summary.merge(
    lap_summary,
    how="left",
    on=["Driver", "Team"],
)

summary = summary[
    [
        "Driver",
        "FullName",
        "Team",
        "GridPosition",
        "Position",
        "Points",
        "PositionsGained",
        "Laps",
        "LapsOnRecord",
        "Status",
        "AvgLapTimeSec",
        "FastestLapTimeSec",
        "AvgSpeedST",
    ]
].sort_values(["Position", "Driver"], na_position="last")

summary.to_csv(SUMMARY_CSV, index=False)

lap_positions = laps[
    [
        "Driver",
        "Team",
        "LapNumber",
        "Position",
        "LapTimeSec",
        "Compound",
        "TyreLife",
        "TrackStatus",
    ]
].copy()

lap_positions = lap_positions.dropna(subset=["Driver", "LapNumber", "Position"])
lap_positions["LapNumber"] = lap_positions["LapNumber"].astype(int)
lap_positions["Position"] = lap_positions["Position"].astype(int)

lap_positions = lap_positions.merge(
    summary[["Driver", "Position"]].rename(columns={"Position": "FinalPosition"}),
    how="left",
    on="Driver",
)

lap_positions = lap_positions.sort_values(["FinalPosition", "Driver", "LapNumber"])
lap_positions.to_csv(LAPS_CSV, index=False)

print(f"Saved {len(summary)} rows to {SUMMARY_CSV.name}")
print(f"Saved {len(lap_positions)} rows to {LAPS_CSV.name}")
