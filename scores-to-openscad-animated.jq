#!/usr/bin/env -S jq -r -f
def z_scale: 0.5;

def index_with($target):
    [., [range(length)]]
  | transpose
  | map(.[0][$target] = .[1] | .[0])
  ;

  sort_by(.game_date) | index_with("nth_of_history")
| reduce .[] as $item ({}; .[$item.boxscore_title] += [$item])
| map_values(sort_by(.nth_of_history) | index_with("nth_of_score") | reverse)
| "scores = ["
, ( .[]
  | "  ["
  , "    [\(.[0].pts_win), \(.[0].pts_lose)],"
  , "    ["
  , (.[] |
    "      [\(.nth_of_history), \(.nth_of_score + 1)],"
    )
  , "    ]"
  , "  ],"
  )
, "];"
, "level = $t * 100000;"
, "underlevel = [
  for (x = scores)
      [ x[0]
      , concat([ for (i = x[1]) if (i[0] < level) i[1] ], [0])[0]
      ]
];
underlevel_ = [
  for (x = underlevel) if (x[1] > 0) [x[0][0], x[0][1], x[1]]
];
color(\"lime\")
for (xy = underlevel_) {
    translate([xy[1], xy[0], 0]) cube([1,1,xy[2]*0.5]);
}"
#| "translate([\(.pts_lose), \(.pts_win), 0]) cube([1,1,\(.nth_of_score * z_scale)]);"
