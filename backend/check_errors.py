import sqlite3

conn = sqlite3.connect('db.sqlite3')
jobs = conn.execute('SELECT id, error_message FROM scrapers_scrapejob').fetchall()
with open('errors.txt', 'w', encoding='utf-8') as f:
    for job in jobs:
        f.write(f"Job {job[0]}:\n{job[1]}\n{'-'*40}\n")
