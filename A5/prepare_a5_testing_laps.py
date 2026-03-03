import pandas as pd


INPUT_CSV = "A5/2026_testing_laps.csv"
OUTPUT_CSV = "A5/2026_testing_laps_A5.csv"


def to_seconds(series: pd.Series) -> pd.Series:
    return pd.to_timedelta(series, errors="coerce").dt.total_seconds()


def mode_series(series: pd.Series):
    return series.mode(dropna=True).iloc[0] if series.dropna().any() else None


df = pd.read_csv(INPUT_CSV)

df = df[(df["TestingEvent"] == "Testing 2") & (df["SessionName"] == "Practice 3")].copy()

df["LapTimeSec"] = to_seconds(df["LapTime"])
df["Sector1Sec"] = to_seconds(df["Sector1Time"])
df["Sector2Sec"] = to_seconds(df["Sector2Time"])
df["Sector3Sec"] = to_seconds(df["Sector3Time"])

for c in ["LapTimeSec", "Sector1Sec", "Sector2Sec", "Sector3Sec", "TyreLife",
          "SpeedI1", "SpeedI2", "SpeedST", "LapNumber"]:
    df[c] = pd.to_numeric(df[c], errors="coerce")

df["LapStartDate"] = pd.to_datetime(df["LapStartDate"], errors="coerce")

selected_columns = [
    "Driver",
    "Team",
    "TestingEvent",
    "SessionName",
    "LapNumber",
    "LapStartDate",
    "LapTimeSec",
    "TyreLife",
    "SpeedI1",
    "SpeedI2",
    "SpeedST",
    "Sector1Sec",
    "Sector2Sec",
    "Sector3Sec",
    "Compound",
]

clean = df[selected_columns].dropna().copy()
clean["LapStartDate"] = clean["LapStartDate"].dt.strftime("%Y-%m-%d %H:%M:%S")

clean.to_csv(OUTPUT_CSV, index=False)

print(f"Input rows: {len(df)}")
print(f"Output rows: {len(clean)}")
print(f"Saved: {OUTPUT_CSV}")
