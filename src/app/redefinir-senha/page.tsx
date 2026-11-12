import { inspectPasswordResetToken } from "@/application/password-reset-service";
import { ResetPasswordClient } from "@/components/ResetPasswordClient";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const cleanToken = token || "";
  const inspection = await inspectPasswordResetToken(cleanToken);
  return (
    <ResetPasswordClient
      token={cleanToken}
      initialTokenStatus={inspection.status}
      expiresAtIso={inspection.expiresAtIso}
    />
  );
}
