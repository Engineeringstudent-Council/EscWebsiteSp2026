-- Daily tally of site searches that returned no results.
-- One row per (UTC day, normalized query). Nothing else is stored:
-- no IP addresses, user agents, cookies, page paths or timestamps finer than a day.
CREATE TABLE IF NOT EXISTS zero_result_queries (
  day TEXT NOT NULL CHECK (length(day) = 10),
  query TEXT NOT NULL CHECK (length(query) BETWEEN 2 AND 400),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  PRIMARY KEY (day, query)
) WITHOUT ROWID;

