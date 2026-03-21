import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, expiresMinutes = 15): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[paintrunBCN] SendGrid not configured. Password reset link for ${to}: ${resetUrl}`);
    return false;
  }

  const from = "janestrada888@gmail.com";
  try {
    const disableClickTracking = (process.env.DISABLE_SENDGRID_CLICK_TRACKING === 'true');

    const msg: any = {
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
            <!-- Preheader (visible in email preview) -->
            <div style="display:block; max-height:0px; overflow:hidden; color:transparent; opacity:0; height:0; width:0;">Restablece tu contraseña: ${resetUrl}</div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f6f6f6; padding:12px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; margin:0 auto; border-radius:6px;">
                    <tr>
                      <td style="padding:16px; font-family: Arial, sans-serif; color:#111111; text-align:center;">
                        <p style="margin:0 0 8px 0; font-size:15px;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                        <p style="margin:0 0 8px 0; font-size:13px;"><a href="${resetUrl}" style="color:#007bff; word-break:break-all;">Abrir enlace para restablecer la contraseña</a></p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px auto;">
                          <tr>
                            <td style="text-align:center;">
                              <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="background:#007bff; color:#ffffff !important; font-weight:bold; padding:15px 30px; text-decoration:none; display:inline-block !important; border-radius:5px; font-size:16px; min-width:200px; line-height:1.4; -webkit-text-size-adjust:100%; mso-padding-alt:15px 30px;">Restablecer contraseña</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:12px 0 0 0; font-size:13px; color:#666666; word-break:break-all;">Si el botón no funciona en tu cliente de correo, copia y pega este enlace en tu navegador:<br/><a href="${resetUrl}" style="color:#007bff; word-break:break-all;">${resetUrl}</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    };

    if (disableClickTracking) {
      msg.tracking_settings = { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } };
    }

    // Plain text fallback
    msg.text = `Restablece tu contraseña aquí: ${resetUrl}`;

    await sgMail.send(msg);
    console.log(`[paintrunBCN] Sent password reset email to ${to}`);
    if (process.env.SHOW_RESET_TOKEN === 'true') {
      console.log(`[paintrunBCN] sent reset href: ${resetUrl}`);
    }
    return true;
  } catch (err: any) {
    console.error(`[paintrunBCN] Failed sending password reset email to ${to}:`, err?.response?.body || err.message || err);
    return false;
  }
}

export default { sendPasswordResetEmail };
