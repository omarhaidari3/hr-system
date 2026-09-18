import { createClient } from '@supabase/supabase-js'

const supabaseUrl ='https://kwweqozaalwibrmrzddx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d2Vxb3phYWx3aWJybXJ6ZGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzA0ODksImV4cCI6MjEwNTI0NjQ4OX0.Kh9rL1EqT354lazV1MuQS8nhkXlf0M0ULdX9KCxxYfM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)