# A3 Seaborn + P5 Setup

$ErrorActionPreference = 'Stop'

# Start in your repo root then:
#   cd C:\Users\alejo\Documents\Repos\AlejandroSpot2.github.io

Set-Location .\A3

# Fresh virtual environment
python -m venv .venv

# Use the venv for install + scripts
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/pip.exe install -r requirements.txt

# Generate Seaborn outputs used by the webpages
./.venv/Scripts/python.exe generate_seaborn_plots.py

Write-Host "Done. Generated files: seaborn_*.png" -ForegroundColor Green
