import { env } from './env';

interface MailpitSummary {
  ID: string;
  Subject: string;
}

/**
 * Waits for an email to `to` whose subject contains `subject` and returns its first link.
 * Local Supabase Auth delivers to Mailpit (config.jsonc).
 */
export async function waitForEmailLink(
  to: string,
  subject: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${env.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const { messages } = (await res.json()) as { messages?: MailpitSummary[] };
    const message = messages?.find((m) => m.Subject.includes(subject));
    if (message) {
      const full = (await (
        await fetch(`${env.mailpitUrl}/api/v1/message/${message.ID}`)
      ).json()) as {
        HTML: string;
      };
      const href = /href="([^"]+)"/.exec(full.HTML)?.[1];
      if (!href) throw new Error(`No link in "${message.Subject}" to ${to}`);
      return href.replaceAll('&amp;', '&');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No "${subject}" email to ${to} within ${String(timeoutMs)} ms`);
}
