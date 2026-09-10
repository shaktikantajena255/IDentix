# IDentix — Start Backend (PowerShell)
# Run this from the project root: identix/

Set-Location "$PSScriptRoot\backend"
$env:PYTHONPATH = $PSScriptRoot + "\backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
