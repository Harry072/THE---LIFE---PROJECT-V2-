import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    # Probe loop_tasks schema by fetching 1 row
    res = supabase.table('loop_tasks').select('*').limit(1).execute()
    if res.data:
        print("Columns found in loop_tasks:", list(res.data[0].keys()))
    else:
        print("Table is empty, trying to fetch schema via metadata (conceptual)")
        # If empty, we can try to insert a dummy and see the error
        dummy = {"user_id": "00000000-0000-0000-0000-000000000000", "title": "test"}
        try:
            supabase.table('loop_tasks').insert(dummy).execute()
        except Exception as e:
            print("Probe Insert Error:", e)
except Exception as e:
    print("Probe Select Error:", e)
