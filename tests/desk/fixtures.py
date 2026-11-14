import json, time, pathlib
d = pathlib.Path(__file__).parent
now = int(time.time()*1000); day = 86400000
backup = {"format":"sula-ledger-backup","version":1,"exportedAt":"2026-11-09T00:00:00Z","count":2,"entries":[
 {"id":"wayfair.com#WF-88213","kind":"purchase","state":"confirmed","merchant":{"name":"Wayfair","domain":"wayfair.com"},
  "amount":{"value":215.42,"raw":"$215.42","currency":"USD"},"orderRef":"WF-88213","capturedAt":now-10*day,"occurredAt":now-10*day,
  "sourceUrl":"https://www.wayfair.com/orders","mine":True,"confidence":0.9},
 {"id":"netflix.com~15.49","kind":"subscription","state":"confirmed","merchant":{"name":"Netflix","domain":"netflix.com"},
  "amount":{"value":15.49,"raw":"$15.49"},"capturedAt":now-20*day,"occurredAt":now-20*day,"renewal":{"cadence":"monthly"},"mine":True,"confidence":0.8}]}
(d/"ledger-backup.json").write_text(json.dumps(backup))
rows = ["Date,Description,Amount"]
for m in range(1,7):
    rows.append(f"2026-{m:02d}-03,NETFLIX.COM 866-579-7172 CA,-15.49")
    rows.append(f"2026-{m:02d}-11,SPOTIFY USA,-11.99")
    rows.append(f"2026-{m:02d}-15,TRADER JOES #123,-{40+m}.17")
(d/"statement.csv").write_text("\n".join(rows))
