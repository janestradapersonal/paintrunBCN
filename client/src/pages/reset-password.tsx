import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    setToken(t);
  }, []);

  const { register, handleSubmit, watch } = useForm<{ newPassword: string; confirmPassword: string }>({ defaultValues: { newPassword: '', confirmPassword: '' } });

  async function onSubmit(values: { newPassword: string; confirmPassword: string }) {
    if (!token) {
      setMessage('Token inválido o expirado');
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setMessage('Las contraseñas no coinciden');
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: values.newPassword }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error || 'Token inválido o expirado');
      } else {
        setMessage('Contraseña actualizada. Puedes iniciar sesión con tu nueva contraseña.');
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch (e) {
      console.error(e);
      setMessage('Error interno');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Restablecer contraseña</CardTitle>
            <CardDescription>Introduce una nueva contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            {message ? (
              <div className="p-4 text-center">{message}</div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                  <Input type="password" {...register('newPassword', { required: true, minLength: 6 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
                  <Input type="password" {...register('confirmPassword', { required: true, minLength: 6 })} />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>Cambiar contraseña</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
