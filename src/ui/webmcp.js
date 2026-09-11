export function registerMarketTools({ getState, selectCompany, investigate }) {
  const context = document.modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "marketeye_read_exposure",
      description: "Read selected company, event exposure and source coverage.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => getState(),
    },
    {
      name: "marketeye_show_company",
      description:
        "Select a supported company and move the visible globe to its footprint.",
      inputSchema: {
        type: "object",
        properties: {
          ticker: { type: "string", enum: ["NVDA", "AAPL", "TSLA"] },
        },
        required: ["ticker"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!["NVDA", "AAPL", "TSLA"].includes(input?.ticker))
          throw new Error("Unsupported company");
        return selectCompany(input.ticker);
      },
    },
    {
      name: "marketeye_run_investigation",
      description:
        "Run the visible company evidence tour and return completion status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: () => investigate(),
    },
  ];
  for (const tool of tools)
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Browser implementation may not support this version. */
    }
  return () => lifecycle.abort();
}
