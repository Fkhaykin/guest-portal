// Textbelt rejects any message containing a URL — even a bare domain like
// guest.summitlakeside.com — until the API key is whitelisted for links
// (verification requested 2026-06-11). Until then, strip links from SMS
// bodies; email, Lodgify, and push copies keep them. Once Textbelt approves
// the key, set SMS_URLS_ALLOWED=true to stop stripping.

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|ai|co|app)\b(?:\/[^\s]*)?/gi;

export function stripUrlsForSms(message: string, replacement = ""): string {
  if (process.env.SMS_URLS_ALLOWED === "true") return message;
  const stripped = message.replace(URL_RE, replacement);
  if (stripped === message) return message;
  return stripped
    .replace(/[ \t]+$/gm, "")
    .replace(/:$/gm, ".") // a removed link often leaves "...at check-in:" dangling
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
