#!/usr/bin/env python3
import csv

def format_url(score):
    win, loss = score
    return f"https://www.pro-football-reference.com/boxscores/game_scores_find.cgi?pts_win={win}&pts_lose={loss}"

with open('all-scores.csv') as fd:
    rows = [row for row in csv.reader(fd)]
    rows = rows[1:] # drop header
    scores = [(int(row[2]), int(row[3])) for row in rows]
    print("\n".join([f"{win} {loss}" for win, loss in scores]))
    #urls = list(map(format_url, scores))
    #print("\n".join(urls))
