# Garmin CSV import

The Add Run page now includes a Garmin CSV tab. Upload an English-header Garmin
activity-list CSV, select its original distance unit, review parsed running
activities, check existing records, and save new records in one batch.

## Database deployment

Before deploying the code, apply `supabase/migrations/004_csv_import.sql` to the
target Supabase database using the Supabase SQL editor or the existing migration
workflow. The new nullable import_key column and unique index are required.
Existing ownership RLS policies remain in effect. No service-role key is needed.

## Import behavior

- Maximum 2 MiB and 5,000 source records. Walking and other non-running types are excluded.
- English Garmin headers are supported; this is not a Strava CSV importer.
- Supports both `YYYY-MM-DD` and `DD/MM/YYYY` date/time formats (with optional seconds), normalized to ISO dates without shifting through browser timezone.
- Supports both `HH:MM:SS` and `MM:SS` for Time (timer duration), not Elapsed Time or Moving Time. Pace is calculated
  from converted distance and timer duration. Miles convert to km and round to 2 decimals.
- Missing optional heart rate/calories remain null. Invalid running rows block saving.
- CSV source start timestamps identify imports; the unique per-user database key
  makes repeat/concurrent CSV requests idempotent. Separate runs on the same day survive.
- Legacy records without import keys are excluded if date, rounded distance and
  duration all match. This is a heuristic: other-source records with different
  durations require user review, and distinct legacy runs with identical values
  cannot be distinguished without their original activity timestamps.
- Each save rechecks existing records. The bulk upsert is one database statement.

## Validation

Run `node --experimental-strip-types --test tests/garmin-csv.test.mjs` with Node 22.6+
and `npx tsc --noEmit`. Integration verification requires a configured Supabase
test account and the migration: preview, save, re-upload, and check another
user's data stays inaccessible. No production records are imported by tests.
