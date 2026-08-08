export function createVariableCases() {
  return [
    {
      expected: ["config/.env.local"],
      feature: "variable-percent",
      level: 2,
      text: "Load %PROJECT_ROOT%/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-shell",
      level: 2,
      text: "Load $PROJECT_ROOT/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-shell-braced",
      level: 2,
      text: "Load ${PROJECT_ROOT}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-cmd-delayed",
      level: 2,
      text: "Load !PROJECT_ROOT!/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-powershell",
      level: 2,
      text: "Load $env:PROJECT_ROOT/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-powershell-braced",
      level: 2,
      text: "Load ${env:PROJECT_ROOT}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-dot-env",
      level: 2,
      text: "Load ${env.PROJECT_ROOT}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-dot-namespace",
      level: 2,
      text: "Load ${variables.PROJECT_ROOT}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-make",
      level: 2,
      text: "Load $(PROJECT_ROOT)/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-make-spaced",
      level: 2,
      text: "Load $( PROJECT_ROOT )/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-mustache",
      level: 2,
      text: "Load {{PROJECT_ROOT}}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-mustache-spaced",
      level: 2,
      text: "Load {{ PROJECT_ROOT }}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-mustache-env",
      level: 2,
      text: "Load {{ env.PROJECT_ROOT }}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-at",
      level: 2,
      text: "Load @PROJECT_ROOT@/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-workflow-env",
      level: 2,
      text: "Load ${{ env.PROJECT_ROOT }}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-workflow-variables",
      level: 2,
      text: "Load ${{ variables.PROJECT_ROOT }}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-dotted-name",
      level: 2,
      text: "Load ${project.root}/config/.env.local.",
    },
    {
      expected: ["config/.env.local"],
      feature: "variable-relative-value",
      level: 2,
      text: "Load $CONFIG_ROOT/.env.local.",
    },
  ];
}
