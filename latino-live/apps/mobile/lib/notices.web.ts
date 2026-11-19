/** The browser has no system notices for this app; everything lives in Avisos. */
export type AppNotice = {
  id: string;
  kind: 'gift' | 'follow' | 'chat';
  title: string;
  body: string;
  at: string;
  slug: string | null;
};

export async function showSystemNotice(): Promise<boolean> {
  return false;
}
