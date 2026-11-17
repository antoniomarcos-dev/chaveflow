import { getPasswordRecoveryConfig } from "@/application/password-reset-service";
import { PasswordRecoveryClient } from "@/components/PasswordRecoveryClient";
import { getDemoOrigin } from "@/lib/demo-config";

export default async function RecuperarSenhaPage() {
  const inDemo = Boolean(getDemoOrigin());
  const availability = inDemo ? "demo" : getPasswordRecoveryConfig() ? "email" : "assisted";
  return <PasswordRecoveryClient availability={availability} />;
}
