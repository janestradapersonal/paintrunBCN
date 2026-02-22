import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, expiresMinutes = 15): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[paintrunBCN] SendGrid not configured. Password reset link for ${to}: ${resetUrl}`);
    return false;
  }

  const from = process.env.SENDGRID_FROM_EMAIL || "no-reply@localhost";
  try {
    await sgMail.send({
      to,
      from,
      subject: "Restablecer contraseña",
      html: `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f6f6f6; padding:20px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; margin:0 auto; border-radius:6px; overflow:hidden;">
                    <tr>
                      <td style="padding:24px; font-family: Arial, sans-serif; color:#111111;">
                        <h2 style="margin:0 0 12px 0; color:#0b74de; font-size:20px;">Restablecer contraseña</h2>
                        <p style="margin:0 0 16px 0; font-size:14px; line-height:1.5;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                        <p style="margin:0 0 20px 0; font-size:14px; line-height:1.5;">Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace caduca en ${expiresMinutes} minutos.</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                          <tr>
                            <td style="text-align:center;">
                              <!-- Button -->
                              <a href="${resetUrl}"
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 style="background:#007bff; color:#ffffff !important; font-weight:bold; padding:15px 30px; text-decoration:none; display:inline-block !important; border-radius:5px; font-size:16px; min-width:200px; line-height:1.4; -webkit-text-size-adjust:100%; box-shadow:0 2px 5px rgba(0,0,0,0.2); mso-padding-alt:15px 30px;">
                                Restablecer contraseña
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:20px 0 0 0; font-size:13px; color:#666666;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
    console.log(`[paintrunBCN] Sent password reset email to ${to}`);
    return true;
  } catch (err: any) {
    console.error(`[paintrunBCN] Failed sending password reset email to ${to}:`, err?.response?.body || err.message || err);
    return false;
  }
}

export default { sendPasswordResetEmail };
