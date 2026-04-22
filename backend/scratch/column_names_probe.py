import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("--- Inspecting loop_tasks Columns via POSTGREST ---")
try:
    # We can try to query a non-existent column to see the 400 error message
    # Sometimes it gives a list of valid columns.
    res = supabase.table('loop_tasks').select('non_existent_column').execute()
except Exception as e:
    print("Column Probe Error:", e)
