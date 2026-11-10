# Sula Desk smoke test

```sh
python -m http.server 8765        # from the repo root
python tests/desk/fixtures.py      # writes the sample backup + statement
python tests/desk/smoke.py         # needs: pip install playwright && playwright install chromium
```

Simulates Pro by writing a cached license to localStorage; the live LemonSqueezy activation is not exercised.
