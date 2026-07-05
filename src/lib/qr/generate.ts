import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function getQRUrl(code: string): string {
  return `${APP_URL}/q/${code}`;
}

export async function generateQRCodePNG(code: string): Promise<Buffer> {
  const url = getQRUrl(code);
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function generateQRCodeSVG(code: string): Promise<string> {
  const url = getQRUrl(code);
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
  });
}

// Arbitrary-URL variants (the code-based helpers above hardcode /q/<code>).

export async function generateUrlQRCodePNG(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function generateUrlQRCodeSVG(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
  });
}
