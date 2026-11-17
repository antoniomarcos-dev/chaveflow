import { readSearchParams, type PageSearchParams } from "@/lib/navigation";
import { inspectPasswordResetToken } from "@/application/password-reset-service";
import { ResetPasswordClient } from "@/components/ResetPasswordClient";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const { token } = await readSearchParams(searchParams);
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
