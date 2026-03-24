/** Active state for bottom / sidebar links (avoids /home matching /homepage, etc.). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  if (href.startsWith("/profile/")) return pathname === href;
  if (href === "/compose") return pathname === "/compose";
  return pathname === href || pathname.startsWith(`${href}/`);
}
