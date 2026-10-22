/** The link someone shares for their profile. Browser-only: it needs the page's origin. */
export const profileUrl = (username: string) => `${window.location.origin}/u/${username}`;
