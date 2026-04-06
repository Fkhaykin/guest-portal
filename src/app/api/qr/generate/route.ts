import { NextResponse } from "next/server";
import { generateQRCodePNG } from "@/lib/qr/generate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  const buffer = await generateQRCodePNG(code);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${code}.png"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
