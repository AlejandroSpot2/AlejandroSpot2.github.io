import fastf1
import pandas as pd

schedule = fastf1.get_event_schedule(2026, include_testing=True)
testing_events = schedule[schedule['EventFormat'] == 'testing']

all_laps = []

for idx, event in testing_events.iterrows():
    event_obj = fastf1.get_testing_session(2026, idx + 1, 1)
    for session_num in range(1, 4):
        try:
            session = fastf1.get_testing_session(2026, idx + 1, session_num)
            session.load()
            laps = session.laps.copy()
            laps['TestingEvent'] = f"Testing {idx + 1}"
            laps['SessionName'] = f"Practice {session_num}"
            all_laps.append(laps)
            print(f"Loaded Testing {idx + 1} - Practice {session_num}: {len(laps)} laps")
        except Exception as e:
            print(f"Could not load Testing {idx + 1} - Practice {session_num}: {e}")

if all_laps:
    combined = pd.concat(all_laps, ignore_index=True)
    combined.to_csv('2026_testing_laps.csv', index=False)
    print(f"\nSaved {len(combined)} total laps to 2026_testing_laps.csv")
else:
    print("No lap data was loaded.")
