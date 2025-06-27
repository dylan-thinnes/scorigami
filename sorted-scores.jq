#!/usr/bin/env -S jq -f
reduce .[] as $item ({}; .[$item.boxscore_title] += [$item]) | map_values(sort_by(.game_date))
