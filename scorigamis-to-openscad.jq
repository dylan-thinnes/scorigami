#!/usr/bin/env -S jq -r -f
  reduce .[] as $item ({}; .[$item.boxscore_title] += [$item]) | map_values(min_by(.game_date)) | [.[]] | sort_by(.game_date)
| [., [range(length)]] | transpose | map(.[0].idx = .[1] | .[0])
| length as $length
| .[]
| "if ($t > \(.idx / $length)) translate([\(.pts_lose), \(.pts_win), 0]) cube([1, 1, 1]);"
