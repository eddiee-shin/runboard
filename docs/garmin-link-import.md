# Garmin activity link import

The upload page accepts public Garmin Connect activity URLs before the CSV tab.
Text copied from the Garmin app may include a sentence and `#beatyesterday`;
the client extracts and displays only the canonical activity URL, and the server
performs the same extraction and validation independently.
The server extracts the numeric activity ID, fetches Garmin's public embed page,
and reads the embedded activity summary. Only HTTPS `connect.garmin.com` activity
URLs and running activity types are accepted, so user input cannot select an
arbitrary fetch host.

Imported rows use `garmin-link:<activity-id>` as their stable import key. A
same-day record within 0.02 km and 2 seconds is also treated as an existing run,
which prevents a Garmin link from duplicating the same activity imported by CSV.
The link must be shared with Garmin privacy set to Everyone.
