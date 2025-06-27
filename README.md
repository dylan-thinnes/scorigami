# Prerequisites

These programs are meant to be run in sequence - each program performs one step
in eventually creating a fully rendered video. They are meant to be run in a
POSIX-like shell prompt, so if you're running Windows, you'll need to install
WSL (Windows Subsystem for Linux) to run it.

Ensure that you have the following programs installed: `python3`, `jq`, `sed`,
`wget`, `openscad`, `ffmpeg`, and GNU Parallel.

# How to run

This repository contains a full CSV list of the ~1000 scores that have happened
in NFL history in `all-scores.csv`. Note this does NOT record every game, only
the most recent game to match a certain score.

We start by running the `all-score-pairs.py` program to extract just the winning
and losing score from `all-scores.csv`:

```bash
> ./all-score-pairs.py all-scores.csv
20 17
27 24
23 20
...
```

Pro Football Reference provides a webpage where you can get every game for a
given score, so we want to iterate through the list of box scores we get from
`./all-score-pairs.py`, and for each box score we download the corresponding
page. This is what `./download-all-score-htmls` does - it takes a list of box
scores as input, and downloads a webpage of all the games for a given score to a
page in the directory `scores`:

```bash
> # We get all the score-pairs, and use the `|` operator to pipe all those
> # box scores to ./download-all-score-htmls
> # We pass '10' to download-all-score-htmls to tell it to wait ten seconds
> # between each download - this is neighbourly, it would be very rude to make
> # too many downloads from Football Reference too quickly.
> ./all-score-pairs.py all-scores.csv | ./download-all-score-htmls 1
...
https://www.pro-football-reference.com/boxscores/game_scores_find.cgi?pts_win=20&pts_lose=17
Resolving www.pro-football-reference.com (www.pro-football-reference.com)... 104.18.13.41, 104.18.12.41, 2606:4700::6812:d29, ...
Connecting to www.pro-football-reference.com (www.pro-football-reference.com)|104.18.13.41|:443... connected.
HTTP request sent, awaiting response... 200 OK
Length: unspecified [text/html]
Saving to: ‘games/games-20-17’
...
> # Once all is downloaded, we can list the games/ directory with `ls` to see
> # all the webpages we've downloaded
> ls games/
games-20-17
games-27-24
...
```

Now that we've downloaded the HTML for each page, we can scrape out the game
data as a much more manipulable format, JSON. We can run `extract-games.py` on a
list of files to get all the games in all the files as one big list:

```bash
> ./extract-games.py games/games-20-17 
...
[{"week_num": 5, "game_day_of_week": "Sun", "game_date": "1944-10-15", "game_outcome": "W", "winner": "Cleveland Rams", "game_location": "@", "loser": "Detroit Lions", "boxscore_word": "boxscore", "pts_win": 20, "pts_lose": 17, "yards_win": 177, "to_win": 3, "yards_lose": 236, "to_lose": 6, "boxscore_titl
...
```

Extract all the games from all the scores into one JSON file called
`all-games.json` with the following command:

```bash
> ./extract-games.py games/* > all-games.json
```

We can run queries over the `all-games.json` file using one of my favourite
programming languages, `jq`. For example, the following program gives the game
that was scorigami for every score in NFL history:

```bash
> jq 'reduce .[] as $item ({}; .[$item.boxscore_title] += [$item]) | map_values(min_by(.game_date))' all-games.json
...
  "9_7": {
    "week_num": 6,
    "game_day_of_week": "Sun",
    "game_date": "1922-11-05",
    "game_outcome": "W",
    "winner": "Chicago Cardinals",
    "game_location": "",
    "loser": "Buffalo All-Americans",
    "boxscore_word": "boxscore",
    "pts_win": 9,
    "pts_lose": 7,
    "yards_win": 0,
    "to_win": 0,
    "yards_lose": 0,
    "to_lose": 0,
    "boxscore_title": "9_7"
  }
}
```

But now we'd like to render the result to the same style as Jon Bois's graph in
the Scorigami series. For this, I reach for `openscad`, which is a convenient
rendering program for making 3D models similar to what you may already be
familiar with (Autodesk Fusion, SketchUp, Blender), but is unique in that it's
entirely driven by its own coding language.

So, by writing a `jq` program that takes in `all-scores.json` and outputs a
OpenSCAD program, we can render our Scorigami results to actual 3D!

For example, the `./scores-to-openscad.jq` will create an OpenSCAD program that
renders a column of the correct height for every score, to give us the same
visualization Jon has:

```bash
> # Run scores-to-openscad on all-scores, and save the resulting OpenSCAD
> # program to scorigami.scad
> ./scores-to-openscad.jq all-scores.json > scorigami.scad
> # Open this program in OpenSCAD and see the visualization!
> openscad scorigami.scad
```

When I run the commands above, I get a pannable, 3D view of the Scorigami map:

![Screenshot of the Scorigami map as rendered by OpenSCAD](docs/scorigami.png)
