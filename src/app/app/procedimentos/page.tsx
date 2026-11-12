import { redirect } from "next/navigation";

export default function ProcedimentosPage() {
  redirect("/app/configuracoes?tab=PROCEDURES");
}
