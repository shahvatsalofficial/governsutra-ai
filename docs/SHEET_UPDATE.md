# Google Sheets Update Helper

The Google Drive/Sheets connector was unavailable in the build session because it is disabled by the workspace administrator. The live spreadsheet was therefore **not modified by this build**.

Two manual application options are supplied:

1. `GovernSutra_AI_Tracker_Patch.xlsx` — separate import-ready tabs for the AI-011 concept row, backlog, agent team, skills, workflows, tool stack, roadmap, development brief and Claude prompt. Copy only the relevant patch ranges into the live workbook; do not replace the whole workbook.
2. `scripts/Google_Sheets_Update.gs` — idempotent Google Apps Script. Open the target spreadsheet, go to **Extensions → Apps Script**, paste the script, save, and run `applyGovernSutraPatch()`. It updates AI-011 and adds/updates the GovernSutra records by stable IDs. Review the script before running and grant only the permissions Google requests for the active spreadsheet.

The script marks the complete AI-011 row green, marks only feature/roadmap rows whose status is `Done` green, and preserves other statuses as `In Progress`, `Research` or `Planned`. It does not call external APIs.

Target spreadsheet: https://docs.google.com/spreadsheets/d/1J4C2xjZEYrMqA_DKTLcGHzLEENZ92VGz9FsMcgk61VA/edit
