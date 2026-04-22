import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def probe_table(name):
    print(f"--- Probing table: {name} ---")
    try:
        res = supabase.table(name).select('*').limit(1).execute()
        print(f"SUCCESS: {name} exists.")
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("Table exists but is empty.")
    except Exception as e:
        print(f"ERROR probing {name}: {e}")

probe_table("loop_tasks")
probe_table("reflections")
probe_table("user_context")
probe_table("profiles")
probe_table("growth_trees")
probe_table("focus_sessions")
probe_table("reading_list")
