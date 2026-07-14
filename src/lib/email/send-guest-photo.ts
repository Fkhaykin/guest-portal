import { Resend } from "resend";

// Emails a guest a copy of a photo they took at the house kiosk. The image is
// attached (not linked), so it works regardless of the Textbelt/SMS URL state
// and lands straight in their inbox ready to save.

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendGuestPhotoEmail(params: {
  to: string;
  propertyName: string;
  contentBase64: string;
  contentType: string;
  filename?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, propertyName, contentBase64, contentType } = params;
  const filename = params.filename ?? "photo.jpg";

  const subject = `Your photo from ${propertyName}`;
  const text = [
    `Here's the photo you took at ${propertyName}.`,
    "",
    "It's attached to this email — save it to your phone or share it however you like.",
    "",
    "Thanks for staying with us!",
    "— Summit Lakeside",
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a;line-height:1.5">
      <p>Here's the photo you took at <strong>${propertyName}</strong>.</p>
      <p>It's attached to this email — save it to your phone or share it however you like.</p>
      <p style="color:#71717a">Thanks for staying with us!<br/>— Summit Lakeside</p>
    </div>`;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: "contact@summitlakeside.com",
      to,
      subject,
      html,
      text,
      attachments: [{ filename, content: contentBase64, contentType }],
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
