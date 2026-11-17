import { getPasswordRecoveryConfig } from "@/application/password-reset-service";
import { PasswordRecoveryClient } from "@/components/PasswordRecoveryClient";
import { getDemoOrigin } from "@/lib/demo-request";

export default async function RecuperarSenhaPage() {
  const inDemo = Boolean(await getDemoOrigin());
  const availability = inDemo ? "demo" : getPasswordRecoveryConfig() ? "email" : "assisted";
  return <PasswordRecoveryClient availability={availability} />;
}
