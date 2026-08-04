(function () {
  var SUPABASE_URL = "https://hnknmdxxkmbtqluiovoe.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhua25tZHh4a21idHFsdWlvdm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTc4NDAsImV4cCI6MjEwMTMzMzg0MH0.4G2QHsnTYiMnHO5bE80rGF2RgMMXmPle-fAh78eCFrw";

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
