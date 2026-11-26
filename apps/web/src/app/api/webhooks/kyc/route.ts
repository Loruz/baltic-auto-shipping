// M2: verify the signature, store the event idempotently, return 200; a worker job processes it (§4.2).
export async function POST() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}
