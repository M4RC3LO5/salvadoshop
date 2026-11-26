import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompradorForm } from "../CompradorForm"

export const dynamic = "force-dynamic"

export default async function NovoCompradorPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: adminUser } = await supabase
    .from("admin_usuarios")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single()
  if (!adminUser) redirect("/")

  const { data: segmentos } = await supabase
    .from("segmentos")
    .select("id, nome")
    .eq("ativo", true)
    .order("ordem", { ascending: true })

  return <CompradorForm segmentos={segmentos ?? []} />
}
