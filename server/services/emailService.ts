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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color:#0b74de">Restablecer contraseña</h2>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace caduca en ${expiresMinutes} minutos.</p>
          <p style="text-align:center; margin: 24px 0;"><a href="${resetUrl}" style="display:inline-block; padding:12px 18px; background:#0b74de; color:#fff; border-radius:6px; text-decoration:none;">Restablecer contraseña</a></p>
          <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        </div>
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
