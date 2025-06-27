#!/usr/bin/env -S jq -r -f
def z_scale: 0.5;

  reduce .[] as $item ({}; .[$item.boxscore_title] += [$item])
| "color(\"lime\") {"
, ( .[]
  | "translate([\(.[0].pts_lose), \(.[0].pts_win), 0]) cube([1, 1, \(length * z_scale)]);"
  )
, "}"
