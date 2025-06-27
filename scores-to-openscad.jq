#!/usr/bin/env -S jq -r -f
def z_scale: 0.5;

def index_with($target):
    [., [range(length)]]
  | transpose
  | map(.[0][$target] = .[1] | .[0])
  ;

  reduce .[] as $item ({}; .[$item.boxscore_title] += [$item])
| map_values(sort_by(.game_date) | index_with("nth_of_score"))
| map_values(max_by(.game_date))
| "color(\"lime\") {"
, ( .[]
  | "translate([\(.pts_lose), \(.pts_win), 0]) cube([1, 1, \(.nth_of_score * z_scale)]);"
  )
, "}"
