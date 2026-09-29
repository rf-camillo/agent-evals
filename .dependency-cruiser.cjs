const layers = [
  "core",
  "scenarios",
  "providers",
  "agent",
  "checks",
  "judge",
  "runner",
  "report",
  "cli",
  "bin",
];

const upwardImports = layers.slice(0, -1).map((layer, index) => ({
  name: `${layer}-stays-below`,
  comment: `src/${layer} may only import from the layers below it`,
  severity: "error",
  from: { path: `^src/${layer}/` },
  to: { path: `^src/(${layers.slice(index + 1).join("|")})/` },
}));

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "error",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "^src/(bin/|index\\.ts$)"] },
      to: {},
    },
    {
      name: "src-not-to-test",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^test/" },
    },
    ...upwardImports,
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: [".ts", ".js"] },
  },
};
