// Classname merger: filters falsy values and joins
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
