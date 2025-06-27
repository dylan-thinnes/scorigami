#!/usr/bin/env -S jq -r -f
def z_scale: 0.5;

def index_with($target):
    [., [range(length)]]
  | transpose
  | map(.[0][$target] = .[1] | .[0])
  ;

  reduce .[] as $item ({}; .[$item.boxscore_title] += [$item])
| map_values(sort_by(.game_date) | index_with("nth_of_score"))
| [.[] | .[]] | sort_by(.game_date)
| index_with("nth_of_history")
| length as $count
| "// length = \($count)"
, "color(\"lime\") {"
, ( .[]
  | "if ($t >= \((.nth_of_history + 0.5) / 100000)) translate([\(.pts_lose), \(.pts_win), \(.nth_of_score * z_scale)]) cube([1, 1, \(z_scale)]);"
  )
, "}"
