import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("--- Deeply Probing loop_tasks columns ---")
# Try to insert a dummy row with only 'user_id' and 'title' to see it succeeds
# Then we can see what columns come back in the result
dummy = {
    "user_id": "00000000-0000-0000-0000-000000000000",
    "title": "Probe Task"
}

try:
    res = supabase.table('loop_tasks').insert(dummy).execute()
    print("Insert SUCCESS.")
    if res.data:
        print("Columns returning from DB:", list(res.data[0].keys()))
        # Clean up
        supabase.table('loop_tasks').delete().eq('id', res.data[0]['id']).execute()
except Exception as e:
    print("Insert ERROR:", e)
