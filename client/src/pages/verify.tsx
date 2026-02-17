import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

export default function VerifyPage() {
  const { verify } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const email = params.get("email") || "";
  const returnTo = params.get("returnTo") || "/";
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [code, setCode] = useState("");

  async function onSubmit() {
    if (code.length !== 6) return;
    setIsPending(true);
    try {
      await verify(email, code);
      toast({ title: "Email verificado", description: "Tu cuenta ha sido activada." });
      navigate(returnTo);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Verifica tu email</CardTitle>
            <CardDescription>
              Hemos enviado un código de 6 dígitos a<br />
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)} data-testid="input-otp">
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              onClick={onSubmit}
              disabled={code.length !== 6 || isPending}
              className="w-full"
              data-testid="button-verify"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verificar
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              En modo desarrollo, el código se muestra en la notificación al registrarse.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
