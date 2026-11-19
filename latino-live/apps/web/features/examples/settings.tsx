"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { initials } from "./sample-data";
import { ExampleHeader, exampleNotice, stackedCardAction, stackedCardDescription } from "./shared";

/* -------------------------------------------------------------------------- */
/* Saved settings (browser storage only)                                      */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "spk:example-profile";

interface Profile {
  name: string;
  email: string;
  bio: string;
  timeZone: string;
}

type NotificationId = "weekly" | "mentions" | "news";

interface Saved {
  profile: Profile;
  notifications: Record<NotificationId, boolean>;
}

const defaults: Saved = {
  profile: { name: "Jordan Lee", email: "jordan@northwind.co", bio: "", timeZone: "singapore" },
  notifications: { weekly: true, mentions: true, news: false },
};

function readSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Partial<Saved>;
    return {
      profile: { ...defaults.profile, ...stored.profile },
      notifications: { ...defaults.notifications, ...stored.notifications },
    };
  } catch {
    return defaults;
  }
}

/** Returns false when the browser refuses to store the settings. */
function writeSaved(saved: Saved): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

const timeZones = [
  { value: "los-angeles", label: "(GMT-8) Los Angeles" },
  { value: "new-york", label: "(GMT-5) New York" },
  { value: "london", label: "(GMT+0) London" },
  { value: "berlin", label: "(GMT+1) Berlin" },
  { value: "mumbai", label: "(GMT+5:30) Mumbai" },
  { value: "singapore", label: "(GMT+8) Singapore" },
  { value: "tokyo", label: "(GMT+9) Tokyo" },
  { value: "sydney", label: "(GMT+10) Sydney" },
];

const notificationOptions: { id: NotificationId; label: string; description: string }[] = [
  { id: "weekly", label: "Weekly report", description: "A summary of your team’s week, every Friday." },
  { id: "mentions", label: "Mentions", description: "When someone mentions you in a check-in." },
  { id: "news", label: "Product news", description: "New features, about once a month." },
];

/* -------------------------------------------------------------------------- */
/* Section navigation                                                         */
/* -------------------------------------------------------------------------- */

interface Section {
  id: string;
  label: string;
  /** The card on this page the item scrolls to. Items without one explain that they are not part of the example. */
  target?: string;
}

const sections: Section[] = [
  { id: "profile", label: "Profile", target: "profile" },
  { id: "account", label: "Account", target: "delete-account" },
  { id: "notifications", label: "Notifications", target: "notifications" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" },
];

function SectionNav() {
  const [current, setCurrent] = useState("profile");

  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-1 text-sm md:flex-col">
      {sections.map((section) => {
        const isCurrent = section.id === current;
        const className = cn(
          "flex h-9 items-center rounded-xl px-3 text-left transition-colors",
          isCurrent ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
        );
        return section.target ? (
          <a
            key={section.id}
            href={`#${section.target}`}
            aria-current={isCurrent ? "true" : undefined}
            className={className}
            onClick={() => setCurrent(section.id)}
          >
            {section.label}
          </a>
        ) : (
          <button key={section.id} type="button" className={className} onClick={() => exampleNotice(`${section.label} page`)}>
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

function DeleteAccountCard() {
  return (
    <Card id="delete-account" className="scroll-mt-6 ring-destructive/30">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription className={stackedCardDescription}>
          Permanently remove your account and all of its data. This can’t be undone.
        </CardDescription>
        <CardAction className={stackedCardAction}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This would permanently remove your account and all of its data. This example has no backend, so confirming
                  won’t delete anything.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    toast.info("Nothing was deleted", { description: "This example has no backend, so your account is unchanged." })
                  }
                >
                  Delete account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

export function SettingsPage() {
  const [saved, setSaved] = useState<Saved>(defaults);
  const [profile, setProfile] = useState<Profile>(defaults.profile);

  // Browser storage is read after hydration so the server and browser render the same first frame.
  useEffect(() => {
    const stored = readSaved();
    setSaved(stored);
    setProfile(stored.profile);
  }, []);

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Saved = { ...saved, profile };
    if (writeSaved(next)) {
      setSaved(next);
      toast.success("Changes saved", { description: "Saved in this browser only." });
    } else {
      toast.error("Couldn’t save your changes", {
        description: "Your edits are still here. Check that this browser allows site storage, then try again.",
      });
    }
  };

  // Switches apply as soon as they are flipped.
  const changeNotification = (id: NotificationId, on: boolean) => {
    const next: Saved = { ...saved, notifications: { ...saved.notifications, [id]: on } };
    setSaved(next);
    if (!writeSaved(next)) {
      toast.error("Couldn’t remember this preference", {
        description: "This browser blocked site storage. The switch keeps working until you leave the page.",
      });
    }
  };

  const timeZone = timeZones.find((item) => item.value === profile.timeZone);

  return (
    <div>
      <ExampleHeader active="settings" className="max-w-5xl" />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and how Tempo works for you.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10">
          <SectionNav />
          <div className="flex min-w-0 flex-col gap-6">
            <form onSubmit={saveProfile}>
              <Card id="profile" className="scroll-mt-6">
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>This is how others see you.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="flex items-center gap-4">
                      <Avatar className="size-16" aria-hidden="true">
                        <AvatarFallback className="text-xl">{initials(profile.name) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => exampleNotice("Photo upload")}>
                          Upload photo
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => exampleNotice("Removing the photo")}>
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="profile-name">Name</FieldLabel>
                        <Input
                          id="profile-name"
                          autoComplete="name"
                          value={profile.name}
                          onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                        <Input
                          id="profile-email"
                          type="email"
                          autoComplete="email"
                          value={profile.email}
                          onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
                      <Textarea
                        id="profile-bio"
                        maxLength={160}
                        placeholder="Tell us a little about yourself"
                        aria-describedby="profile-bio-hint"
                        value={profile.bio}
                        onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
                      />
                      <FieldDescription id="profile-bio-hint">Up to 160 characters. Shown on your public profile.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="profile-time-zone">Time zone</FieldLabel>
                      <Select value={profile.timeZone} onValueChange={(value) => setProfile({ ...profile, timeZone: value })}>
                        <SelectTrigger id="profile-time-zone" className="w-full">
                          <SelectValue>{timeZone?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {timeZones.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="justify-end gap-2 border-t">
                  <Button type="button" variant="ghost" onClick={() => setProfile(saved.profile)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </CardFooter>
              </Card>
            </form>

            <Card id="notifications" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>Email notifications</CardTitle>
                <CardDescription>Pick what lands in your inbox.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  {notificationOptions.map((option) => (
                    <Field key={option.id} orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor={`notify-${option.id}`}>{option.label}</FieldLabel>
                        <FieldDescription id={`notify-${option.id}-description`}>{option.description}</FieldDescription>
                      </FieldContent>
                      <Switch
                        id={`notify-${option.id}`}
                        aria-describedby={`notify-${option.id}-description`}
                        checked={saved.notifications[option.id]}
                        onCheckedChange={(on) => changeNotification(option.id, on)}
                      />
                    </Field>
                  ))}
                </FieldGroup>
              </CardContent>
            </Card>

            <DeleteAccountCard />
          </div>
        </div>
      </main>
    </div>
  );
}
