type EmailPurpose = "link" | "password_reset";

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
    process.env.EMAIL_FROM?.trim(),
  );
}

export async function sendEmailCode(
  recipient: string,
  code: string,
  purpose: EmailPurpose,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured");
  }

  const isReset = purpose === "password_reset";
  const subject = isReset
    ? "Восстановление доступа к TeleChatYou"
    : "Подтверждение почты TeleChatYou";
  const heading = isReset
    ? "Код для восстановления доступа"
    : "Подтверди свою почту";
  const explanation = isReset
    ? "Введи этот код на экране восстановления TeleChatYou, чтобы задать новый пароль."
    : "Введи этот код в TeleChatYou, чтобы подтвердить, что это твой адрес электронной почты.";
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:28px;background:#fff7ef;font-family:Arial,Helvetica,sans-serif;color:#554260">
    <main style="max-width:480px;margin:0 auto;padding:28px;border-radius:24px;background:#fffdf9;border:1px solid #f0dce9">
      <div style="font-size:14px;font-weight:800;letter-spacing:2px;color:#9b7bb5">TELECHATYOU</div>
      <h1 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#604968">${heading}</h1>
      <p style="font-size:15px;line-height:1.65;margin:0;color:#806d88">${explanation}</p>
      <div style="margin:24px 0;padding:18px 12px;border-radius:18px;background:#f6e8ff;text-align:center;font-size:32px;letter-spacing:9px;font-weight:800;color:#604968">${code}</div>
      <p style="font-size:13px;line-height:1.6;color:#9b87a2">Код действует 10 минут. Никому не сообщай его — сотрудники TeleChatYou не будут его спрашивать.</p>
      <p style="font-size:12px;color:#ad9ab4;margin-top:26px">Если ты не запрашивал этот код, просто проигнорируй письмо.</p>
    </main>
  </body>
</html>`;
  const text = `${heading}\n\n${explanation}\n\nКод: ${code}\n\nКод действует 10 минут. Никому не сообщай его.`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      html,
      text,
      tags: [{ name: "purpose", value: purpose }],
    }),
  });

  if (!response.ok) {
    // Do not expose the provider response or credentials through the UI.
    const providerMessage = await response.text().catch(() => "");
    console.error("Transactional email delivery failed", response.status, providerMessage.slice(0, 500));
    throw new Error("Email delivery failed");
  }
}
