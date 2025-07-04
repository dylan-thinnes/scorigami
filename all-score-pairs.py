#!/usr/bin/env python3
import csv
import sys

with open(sys.argv[1]) as fd:
    rows = [row for row in csv.reader(fd)]
    rows = rows[1:] # drop header
    scores = [(int(row[2]), int(row[3])) for row in rows]
    print("\n".join([f"{win} {loss}" for win, loss in scores]))
