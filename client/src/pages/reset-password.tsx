import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    if (values.newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
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
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pointer-events-auto" style={{ touchAction: 'manipulation' }}>
                <div>
                  <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} {...register('newPassword', { required: true, minLength: 6 })} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} {...register('confirmPassword', { required: true, minLength: 6 })} />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="block w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg relative z-10"
                  disabled={isPending}
                >
                  Cambiar contraseña
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
