import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { LoginPage } from "@/features/auth/pages";
import { ExampleBrand } from "./shared";

/**
 * LoginPage draws its own full-screen frame: a `main` with min-h-screen, a tinted
 * background and padding (and a min-h-screen placeholder while the account loads).
 * Inside this layout those are switched off so the form sits in the column; the
 * form itself is the unchanged, working LoginPage.
 */
const formColumn =
  "w-full max-w-sm [&>main]:min-h-0 [&>main]:bg-transparent [&>main]:p-0 [&>[role=status]]:min-h-60 [&>[role=status]]:rounded-2xl [&>[role=status]]:border";

const dots = {
  backgroundImage: "radial-gradient(color-mix(in oklch, var(--foreground) 12%, transparent) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
};

export function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <ExampleBrand href="/examples/landing" />
        <div className="flex flex-1 items-center justify-center">
          <div className={formColumn}>
            <h1 className="sr-only">Sign in to Tempo</h1>
            <LoginPage allowEmailOtp redirectTo="/examples/dashboard" />
          </div>
        </div>
      </div>
      <aside aria-label="What customers say" className="relative hidden overflow-hidden bg-muted lg:block">
        <div className="absolute inset-0" style={dots} aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <Card className="max-w-md shadow-2xl shadow-foreground/10">
            <CardContent>
              <figure className="flex flex-col gap-6">
                <blockquote className="text-lg leading-relaxed">
                  “Tempo replaced our Monday status meeting. Everyone knows the plan before their first coffee.”
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>MR</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-sm">
                    <span className="font-medium">Maya Reyes</span>
                    <span className="text-muted-foreground">Head of Ops, Lumen</span>
                  </div>
                </figcaption>
              </figure>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
