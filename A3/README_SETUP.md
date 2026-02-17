# A3 Setup (quick start)

This folder uses a local Python venv to run the Seaborn chart script.

From repo root:
1) Open PowerShell in `C:\Users\alejo\Documents\Repos\AlejandroSpot2.github.io`
2) Run:

```powershell
.
A3\setup_venv.ps1
```

That script will:
- create `A3\.venv`
- install packages in `A3/requirements.txt`
- generate:
  - `A3/seaborn_histogram_races.png`
  - `A3/seaborn_boxplot_points_by_driver.png`
  - `A3/seaborn_strip_laps_by_driver.png`
  - `A3/seaborn_ecdf_races_per_driver.png`

If you already have dependencies, you can run only:

```powershell
cd A3
./.venv/Scripts/python.exe generate_seaborn_plots.py
```

`A3/.venv` is in `.gitignore` and should not be committed.
