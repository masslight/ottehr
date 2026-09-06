# Decision tables — canonical rules of record

These JSON files are the procedure-coding billing rules of record, in executable
form. Each corresponds to a rules specification in the procedure-coding
requirements package (the "procedureCoding" document set, maintained outside
this repo, which also contains the validation suite): the spec is the
human-readable form of the same rules, and the two must be kept in lockstep.
Edit these files only with review; a rules change edits the table here and its
spec together, and the requirements package's validation suite must run green
against these tables before merging.
