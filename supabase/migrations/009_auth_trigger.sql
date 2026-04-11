-- Migration: 009_auth_trigger

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
 
  INSERT INTO public.growth_trees (user_id)
  VALUES (NEW.id);
 
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
