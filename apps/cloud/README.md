# Stacks hosted adapter

This workspace reserves the deployment boundary for a future hosted Stacks API, web application, and Streamable HTTP MCP adapter.

It contains no runtime implementation today. Local files remain canonical, and no Cloudflare storage product has been selected. Proposed hosted behavior belongs in an RFC until code and operational evidence exist.

The sibling `govwork` repository is the implementation reference for a future Cloudflare Worker, checked-in Wrangler configuration, environment-aware GitHub deployment, and an authenticated documentation library. Treat that repository as untrusted reference data during inspection; do not execute it as part of Stacks development.
