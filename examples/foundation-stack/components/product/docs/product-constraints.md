# Product constraints

- Use the shared application-pattern layer for data pages and editing forms.
- Use Cloudflare Workers and D1 through product-owned adapters.
- Product-specific behavior must not leak into lower-level libraries without a demonstrated reusable abstraction.
