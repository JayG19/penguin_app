/** Dates → ISO strings; Prisma rows → plain JSON for client components. */
export function serialize<T>(x: unknown): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
