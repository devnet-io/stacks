# Current ecosystem notes (August 29, 2026)

These notes explain choices in the starter and should be rechecked before depending on unstable APIs.

- Codex uses layered `AGENTS.md` files for persistent repository guidance. OpenAI documentation: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Current OpenAI Skill bundles use a required `SKILL.md` with YAML frontmatter and may include `agents/openai.yaml`, scripts, references, and assets. OpenAI skills repository: https://github.com/openai/skills
- MCP specification version `2026-07-28` is current at the time of this archive. Specification: https://modelcontextprotocol.io/specification/2026-07-28
- The TypeScript MCP SDK v2 is the stable line for that specification and uses split packages such as `@modelcontextprotocol/server`. Documentation: https://ts.sdk.modelcontextprotocol.io/v2/
- OpenAI supports MCP-backed integrations in ChatGPT, Codex, and the API, but Stacks should remain usable without an OpenAI-specific host. OpenAI guide: https://developers.openai.com/api/docs/mcp

Do not copy protocol details from this file into the domain model. Keep MCP-specific behavior in the adapter and update it independently.
