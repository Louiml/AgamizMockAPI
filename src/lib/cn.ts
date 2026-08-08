export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(" ");

export const ucfirst = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;