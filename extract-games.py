#!/usr/bin/env python3
import bs4
import urllib.request
import sys
import json

def convert_row(row):
    dat = {}
    cells = row.find_all('td')
    for cell in cells:
        try:
            cell_val = int(cell.text)
        except ValueError:
            cell_val = cell.text
        dat[cell.attrs['data-stat']] = cell_val
    dat['boxscore_title'] = str(dat['pts_win']) + "_" + str(dat['pts_lose'])
    return dat

data = []

for filename in sys.argv[1:]:
    print(filename, file=sys.stderr)
    with open(filename) as fd:
        soup = bs4.BeautifulSoup(fd, features="lxml")
        tbody = soup.find_all('tbody')[0]
        data += [convert_row(row) for row in tbody.find_all('tr')]

json.dump(data, sys.stdout)
