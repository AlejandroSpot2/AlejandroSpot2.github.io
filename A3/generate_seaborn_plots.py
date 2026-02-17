import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter


df = pd.read_csv("Formula1_2025Season_RaceResults.csv")

# Make sure columns are numeric where needed
df["Points"] = pd.to_numeric(df["Points"], errors="coerce")
df["Laps"] = pd.to_numeric(df["Laps"], errors="coerce")

driver_counts = df["Driver"].value_counts().rename_axis("Driver").reset_index(name="Races")

# Histogram of race counts per driver
plt.figure(figsize=(10, 6))
sns.set_style("whitegrid")
sns.histplot(driver_counts["Races"], bins=8, color="#4682B4")
plt.title("F1 Driver Race Count Distribution")
plt.xlabel("Number of races in season")
plt.ylabel("Number of drivers")
plt.tight_layout()
plt.savefig("seaborn_histogram_races.png", dpi=150)
plt.close()

# Keep the same top drivers for all comparisons
top_drivers = driver_counts["Driver"].head(12).tolist()
df_top = df[df["Driver"].isin(top_drivers)]

# Box plot: points distribution per driver with outliers
plt.figure(figsize=(11, 7))
sns.set_style("whitegrid")
sns.boxplot(data=df_top, x="Driver", y="Points")
plt.title("Points Distribution by Driver (Top 12)")
plt.xlabel("Driver")
plt.ylabel("Points")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig("seaborn_boxplot_points_by_driver.png", dpi=150)
plt.close()

# Strip plot: laps by driver (with jitter)
plt.figure(figsize=(11, 7))
sns.set_style("whitegrid")
sns.stripplot(data=df_top, x="Driver", y="Laps", jitter=True)
plt.title("Lap Counts by Driver (Top 12)")
plt.xlabel("Driver")
plt.ylabel("Laps")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig("seaborn_strip_laps_by_driver.png", dpi=150)
plt.close()

# ECDF plot: race-count distribution (races per driver)
plt.figure(figsize=(11, 7))
sns.set_style("whitegrid")
sns.ecdfplot(data=driver_counts, x="Races")
plt.title("ECDF of Races per Driver")
plt.xlabel("Number of races")
ax = plt.gca()
ax.yaxis.set_major_formatter(PercentFormatter(1.0))
plt.ylabel("Cumulative % of Drivers")
plt.tight_layout()
plt.savefig("seaborn_ecdf_races_per_driver.png", dpi=150)
plt.close()
