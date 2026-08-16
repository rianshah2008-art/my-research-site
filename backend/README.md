# Deprecated — use the TypeScript sync instead

Garmin sync now runs entirely in Node via `lib/garmin-sync.ts` and
`POST /api/sync-garmin` using the `garmin-connect` npm package.

This Python script is kept only as a local reference / fallback for
environments that already have `python-garminconnect` installed. It is
**not** used by the Vercel deployment.

```bash
# Prefer:
#   curl -X POST http://localhost:3000/api/sync-garmin
#
# Optional local fallback:
#   pip install -r backend/requirements.txt
#   python backend/garmin_sync.py
```
