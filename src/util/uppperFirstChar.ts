export const upperFirstChar = (str: string) =>
  str.length === 0 ? "" : str.charAt(0).toUpperCase() + str.substring(1);
