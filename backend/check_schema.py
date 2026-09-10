import sqlite3
conn = sqlite3.connect('identix.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(blacklist_cache)")
cols = cursor.fetchall()
print("blacklist_cache columns:")
for c in cols:
    print(" ", c)

cursor.execute("SELECT COUNT(*) FROM blacklist_cache")
count = cursor.fetchone()[0]
print(f"\nRows: {count}")
conn.close()
