export default {
  async fetch(request: Request, env: unknown): Promise<Response> {
    void request;
    void env;
    return new Response("Reference only", { status: 501 });
  },
};
