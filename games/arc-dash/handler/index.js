export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/health')) {
      return new Response(JSON.stringify({ ok: true, game: 'arc-dash' }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  },
}
