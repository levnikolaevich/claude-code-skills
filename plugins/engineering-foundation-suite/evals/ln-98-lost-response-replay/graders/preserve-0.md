---
type: regex
target: { source: file, path: policy.md }
pattern: '^This\ single\-threaded\ in\-memory\ fixture\ represents\ a\ committed\ authoritative\ state\.\ Matching\ key/amount\ replays\ return\ the\ prior\ result\ without\ charging\ again;\ changed\ amount\ with\ same\ key\ raises\ ValueError\.\ It\ does\ not\ demonstrate\ production\ durability\ or\ concurrent\ transaction\ safety\.\n$'
flags: s
---
