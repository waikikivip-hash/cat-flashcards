import { createClient } from '@supabase/supabase-js'

// 让程序自己去读取 .env 文件里的真实钥匙，绝对不人工瞎猜
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)