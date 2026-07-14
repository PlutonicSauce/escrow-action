export interface DependencyMapping {
  displayName: string;
  dependencyNames: readonly string[];
}

export const DEPENDENCY_MAPPINGS = [
  { displayName: "Vitest", dependencyNames: ["vitest"] },
  { displayName: "Jest", dependencyNames: ["jest"] },
  { displayName: "TypeScript", dependencyNames: ["typescript"] },
  { displayName: "ESLint", dependencyNames: ["eslint"] },
  { displayName: "Prettier", dependencyNames: ["prettier"] },
  { displayName: "Vite", dependencyNames: ["vite"] },
  { displayName: "Next.js", dependencyNames: ["next"] },
  { displayName: "React", dependencyNames: ["react"] },
  {
    displayName: "Playwright",
    dependencyNames: ["@playwright/test", "playwright"],
  },
] as const satisfies readonly DependencyMapping[];

export function findDependencyMapping(
  frameworkOrTool: string,
): DependencyMapping | undefined {
  const normalizedName = frameworkOrTool.trim().toLocaleLowerCase("en-US");

  return DEPENDENCY_MAPPINGS.find(
    (mapping) =>
      mapping.displayName.toLocaleLowerCase("en-US") === normalizedName,
  );
}
