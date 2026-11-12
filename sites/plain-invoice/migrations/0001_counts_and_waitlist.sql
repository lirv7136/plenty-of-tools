-- Anonymous totals per day and event: no visitor ids, no IP addresses, nothing per person.
CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, event TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, event));
-- People who asked to be told when Pro opens. Only what they typed, the feature and the date.
CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, feature TEXT NOT NULL, created TEXT NOT NULL);
