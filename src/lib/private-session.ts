export const PRIVATE_SIGNOUT_EVENT = "patentradar-private-signout";
/** Clear transient private handoffs without deleting deliberately saved device drafts. */
export function clearPrivateSessionView() {
  try {
    for (const key of [
      "patentradar-private-file-handoff",
      "patentradar-design-return-v1",
      "patentradar-engineering-handoff",
    ])
      sessionStorage.removeItem(key);
  } catch {}
  window.dispatchEvent(new Event(PRIVATE_SIGNOUT_EVENT));
}
