# Improve DDO / DDS sheet copies

Open https://script.google.com → New project, paste `improve-copies.gs`, choose `improveKimoSheetCopies` and Run. Google will request permission to read the three source spreadsheets and create editable copies in your Drive. Each successful copy URL appears in Execution log. Originals are unchanged. Run creates new copies each time; do not run repeatedly unless you want additional copies.

The script creates task/operations dashboards, supports On Hold, preserves duplicate DDO IDs with unique row keys, flags missing PIC/date order, replaces locale-dependent DATEVALUE calendar formulas with numeric DATE formulas, fixes truncated commercial/finance totals, calculates weighted margin, guards zero denominators, and archives outdated Achievement formulas before building a new source dashboard. It does not reinterpret revenue recognition or agency fee treatment, or reconcile manual profits without confirmed accounting rules. Sources with changed financial headers stop for manual review; a partially prepared copy may remain in Drive.

Review the copied sheets before replacing any OS source URLs. Existing Google permissions in KIMO OS are read-only and this chat cannot execute the script in your Google account.
