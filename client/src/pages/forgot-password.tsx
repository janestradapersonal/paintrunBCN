import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const { register, handleSubmit } = useForm<{ email: string }>({ defaultValues: { email: "" } });

  async function onSubmit(values: { email: string }) {
    setIsPending(true);
    try {
      await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.email }) });
      setSent(true);
    } catch (e) {
      console.error(e);
      setSent(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>¿Olvidaste tu contraseña?</CardTitle>
            <CardDescription>Introduce el email asociado a tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            {!sent ? (
              <Form>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={undefined as any}
                    name="email"
                    render={() => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="tu@email.com" type="email" {...register('email', { required: true })} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isPending}>Enviar</Button>
                </form>
              </Form>
            ) : (
              <div className="p-4 text-center">
                <p>Si existe una cuenta con ese correo, te enviaremos un enlace para restablecerla.</p>
                <p className="mt-4"><Link href="/login" className="text-primary">Volver al inicio</Link></p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
