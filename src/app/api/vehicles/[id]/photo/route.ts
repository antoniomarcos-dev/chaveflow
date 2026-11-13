import { getVehiclePhoto } from "@/application/vehicle-photo-service";
import { AuthorizationError } from "@/domain/permissions";
import { getServerSessionContext } from "@/lib/server-session";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getServerSessionContext();
    const accessToken =
      new URL(request.url).searchParams.get("accessToken") || undefined;
    if (!ctx && !accessToken) return new NextResponse(null, { status: 401 });
    const photo = await getVehiclePhoto(ctx, (await params).id, accessToken);
    if (!photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(photo.content), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: error instanceof AuthorizationError ? error.statusCode : 500,
    });
  }
}
