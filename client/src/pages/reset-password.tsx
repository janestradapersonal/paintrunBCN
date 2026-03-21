import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenIsInvalid, setTokenIsInvalid] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setTokenIsInvalid(true);
      setMessage('Token no encontrado en la URL');
      setMessageType('error');
    }
    setToken(t);
  }, []);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<{ newPassword: string; confirmPassword: string }>({
    defaultValues: { newPassword: '', confirmPassword: '' },
    mode: 'onBlur'
  });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  async function onSubmit(values: { newPassword: string; confirmPassword: string }) {
    if (!token) {
      setMessage('Token inválido o expirado');
      setMessageType('error');
      return;
    }

    if (values.newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      setMessageType('error');
      return;
    }

    if (values.newPassword !== values.confirmPassword) {
      setMessage('Las contraseñas no coinciden');
      setMessageType('error');
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.error || 'Error al cambiar la contraseña';
        setMessage(errorMsg);
        setMessageType('error');
      } else {
        setMessage('Contraseña actualizada correctamente. Redirigiendo a login...');
        setMessageType('success');
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch (e) {
      console.error('Reset password error:', e);
      setMessage('Error de conexión. Por favor, intenta de nuevo.');
      setMessageType('error');
    } finally {
      setIsPending(false);
    }
  }

  if (tokenIsInvalid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-red-600 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Token no encontrado. Por favor, solicita un nuevo enlace de recuperación.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
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
            {message && (
              <div className={`mb-4 p-4 rounded-md flex items-start gap-2 ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{message}</p>
              </div>
            )}

            {!message || messageType === 'error' ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      {...register('newPassword', {
                        required: 'Este campo es requerido',
                        minLength: {
                          value: 6,
                          message: 'Mínimo 6 caracteres'
                        }
                      })}
                      className={errors.newPassword ? 'border-red-500' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      {...register('confirmPassword', {
                        required: 'Este campo es requerido',
                        minLength: {
                          value: 6,
                          message: 'Mínimo 6 caracteres'
                        }
                      })}
                      className={errors.confirmPassword ? 'border-red-500' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-600 text-sm mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
                  disabled={isPending || !!errors.newPassword || !!errors.confirmPassword}
                >
                  {isPending ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
