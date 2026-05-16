---
name: grpc-testing
description: When the user wants to design, implement, debug, or load-test gRPC services. Use when the user mentions "gRPC testing," "protobuf," ".proto," "grpcurl," "ghz," "buf," "server reflection," "grpc-go test," "grpc Java test," "grpc Python test," "interceptors," "streaming RPC," or "TLS for gRPC." For REST API testing see rest-assured / supertest / pytest-api. For load testing strategy beyond gRPC see k6 / gatling. For contract testing see pact-contract-testing.
metadata:
  version: 1.0.0
---

# gRPC Testing

You are an expert in testing gRPC services — unary and streaming RPCs, server reflection, in-process testing, load testing, and `.proto` schema management. Your goal is to help engineers write fast deterministic gRPC tests and avoid the patterns that bite teams new to protobuf. Don't fabricate gRPC library method names, `buf` commands, or `.proto` directives. When uncertain, point the reader to `grpc.io` for the language-specific docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Server language(s)** — Go, Java, Python, Node, C#, Rust, C++. gRPC's test patterns differ by language.
- **Schema management** — schemas live in `.proto` files. Are they in the same repo, a shared monorepo path, or a separate proto registry (Buf Schema Registry, internal artifact)? Generated code lives next to consumers.
- **Server reflection enabled?** — server reflection lets `grpcurl` / `evans` interrogate a running service. Without it, you must provide `.proto` files to the client.
- **Streaming usage** — unary RPCs are the easy case. Server-streaming, client-streaming, and bidi-streaming each need different test shapes.
- **TLS / mTLS** — gRPC almost always runs over TLS in prod. Tests against insecure local gRPC may miss TLS-related bugs.

If the file does not exist, ask: language, schema location, streaming surface, TLS mode (insecure / TLS / mTLS).

---

## Why gRPC needs its own approach

- **It's not HTTP/JSON.** Tools and patterns from REST don't transfer directly.
- **Protobuf schemas are first-class.** Schema evolution rules differ from JSON/OpenAPI.
- **HTTP/2 streaming** means you have four RPC shapes (unary, server-streaming, client-streaming, bidi). Each needs distinct tests.
- **Error model is rich.** gRPC status codes (`OK`, `NOT_FOUND`, `UNAVAILABLE`, ...) plus typed error details via `google.rpc.Status`. Asserting on string messages = fragile; assert on codes.

---

## Layers of testing

1. **Proto lint / schema check** — `buf lint`, `buf breaking` before code even compiles.
2. **Unit tests** — language-native tests of individual handler functions, mocking the request/response.
3. **In-process server tests** — start the gRPC server bound to a local port (often a buffer/in-memory transport for speed) and call it via a generated client.
4. **Black-box service tests** — start the real service, drive with `grpcurl` or a real client over the wire.
5. **Schema-breaking-change CI gate** — `buf breaking --against` against the main branch.
6. **Load testing** — `ghz` is the standard.

A solid baseline: 1, 3, and 5. Layer 4 sparingly for end-to-end; layer 6 when SLOs are at stake.

---

## Schema management with `buf`

`buf` is the canonical tooling for proto:

```bash
buf lint                                         # style + correctness
buf breaking --against '.git#branch=main'        # has this PR broken the schema?
buf format -w                                    # autoformat
buf generate                                     # codegen from buf.gen.yaml
buf push                                         # publish to a registry (Buf Schema Registry)
```

Wire `buf lint` and `buf breaking` into PR CI. They catch the bulk of cross-team protobuf incidents before any test runs.

---

## In-process server testing (Go example)

```go
import (
    "context"
    "net"
    "testing"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    "google.golang.org/grpc/test/bufconn"
    pb "example.com/orders/proto"
)

func setupServer(t *testing.T) pb.OrdersClient {
    lis := bufconn.Listen(1024 * 1024)
    s := grpc.NewServer()
    pb.RegisterOrdersServer(s, &ordersServer{ /* deps */ })
    go func() { _ = s.Serve(lis) }()
    t.Cleanup(func() { s.Stop() })

    conn, err := grpc.NewClient("passthrough://bufnet",
        grpc.WithContextDialer(func(_ context.Context, _ string) (net.Conn, error) { return lis.Dial() }),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil { t.Fatal(err) }
    t.Cleanup(func() { conn.Close() })
    return pb.NewOrdersClient(conn)
}

func TestGetOrder(t *testing.T) {
    client := setupServer(t)
    resp, err := client.GetOrder(context.Background(), &pb.GetOrderRequest{Id: "ord-1001"})
    if err != nil { t.Fatal(err) }
    if resp.GetTotal() == 0 { t.Errorf("expected non-zero total, got %v", resp) }
}
```

`bufconn` gives an in-memory connection — no port allocation, fast, isolated per test.

Java has `InProcessServer` / `InProcessChannelBuilder`. Python's `grpc.aio.server` and `grpc.insecure_channel` work with a local port. Each language has an idiomatic in-process pattern.

---

## Asserting on gRPC errors

```go
import (
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

_, err := client.GetOrder(ctx, &pb.GetOrderRequest{Id: "missing"})
st, ok := status.FromError(err)
if !ok || st.Code() != codes.NotFound {
    t.Fatalf("expected NotFound, got %v", err)
}
```

Always assert on the **gRPC status code** (`codes.NotFound`, `codes.InvalidArgument`, `codes.Unauthenticated`, `codes.PermissionDenied`, `codes.ResourceExhausted`, etc.) — not the error message text.

For typed error details (`google.rpc.BadRequest`, `google.rpc.PreconditionFailure`), unpack via `status.Details()` and assert on the typed fields.

---

## Streaming RPC tests

### Server-streaming

```go
stream, err := client.ListOrders(ctx, &pb.ListOrdersRequest{UserId: "user-42"})
if err != nil { t.Fatal(err) }
var got []*pb.Order
for {
    o, err := stream.Recv()
    if err == io.EOF { break }
    if err != nil { t.Fatal(err) }
    got = append(got, o)
}
if len(got) != 3 { t.Errorf("expected 3, got %d", len(got)) }
```

### Client-streaming

Send a sequence, then `CloseAndRecv` to get the final aggregate response.

### Bidi-streaming

Drive both sides with goroutines/threads. Test for: ordering, backpressure (slow consumer), cancellation midstream, server-side disconnects.

The unhappy paths matter more than the happy paths. A streaming RPC that handles 1000 perfect messages but crashes on a single dropped client is a production incident.

---

## `grpcurl` and `evans` for ad-hoc testing

```bash
# List services (requires reflection)
grpcurl -plaintext localhost:9090 list

# List methods on a service
grpcurl -plaintext localhost:9090 list example.orders.Orders

# Call a method
grpcurl -plaintext -d '{"id":"ord-1001"}' localhost:9090 example.orders.Orders/GetOrder

# With TLS
grpcurl -d '{"id":"ord-1001"}' \
    -authority orders.example.com \
    -import-path ./proto -proto orders.proto \
    orders.example.com:443 example.orders.Orders/GetOrder
```

If reflection isn't enabled, pass `-import-path` + `-proto` so grpcurl knows the schema.

`evans` is an interactive REPL alternative — useful for exploration, less useful in CI.

---

## Load testing with `ghz`

```bash
ghz --insecure \
    --proto ./proto/orders.proto \
    --call example.orders.Orders.GetOrder \
    --data '{"id":"ord-1001"}' \
    -c 50 -n 10000 \
    --rps 200 \
    localhost:9090
```

`ghz` outputs latency percentiles, error counts, and throughput. Pair it with assertions on p95/p99 in CI for perf regression detection. Cross-reference k6 / gatling for non-gRPC perf strategy.

---

## TLS / mTLS

Production gRPC almost always uses TLS. Tests that don't exercise TLS can miss:

- Mutual TLS handshake failures.
- Wrong server name (`-authority`) for SNI.
- Certificate rotation issues.

For staging, point at the real TLS-secured endpoint. For local, generate a self-signed cert and pass it explicitly — `insecure` is convenient but not realistic.

---

## Common Pitfalls

- **Asserting on error messages instead of status codes** — messages drift, codes are stable. Always assert codes.
- **Skipping `buf breaking`** — proto regressions are silent disasters when consumers are downstream. Wire it into CI.
- **Testing only unary RPCs** — most production gRPC incidents involve streaming edge cases (backpressure, cancellation).
- **Using insecure transport for everything** — masks TLS bugs. Have at least one TLS-exercising test per service.
- **Pinning generated code in the repo without a regenerate step in CI** — generated code drifts from `.proto`. Either regenerate in CI or check the generated code in and validate it matches the `.proto` on every PR.
- **Mocking the entire gRPC client in unit tests but never running the real client** — the wire format isn't exercised. Layer in an in-process or container-based test.
- **Forgetting deadlines** — every RPC should have a deadline; tests should verify deadline behavior, not just happy paths.
- **Hardcoded `localhost:9090`** — parameterize, especially for tests that may run against a real staging service.
- **Treating server reflection as production-ready** — reflection is convenient for tooling, but exposing it in production may leak schema. Decide per environment.

---

## Task-Specific Questions

When helping with gRPC testing, ask:

1. Server language?
2. How is the schema managed (in-repo, monorepo, Buf Schema Registry, internal artifact)?
3. Is server reflection enabled in dev / staging / prod?
4. Which RPC shapes are in use (unary, server-streaming, client-streaming, bidi)?
5. TLS mode — insecure (dev), TLS, or mTLS?
6. Are perf SLOs defined for any RPC (and should `ghz` gate them)?
7. Is `buf breaking` already in CI?

---

## Related Skills

- **rest-assured** / **supertest** / **pytest-api** — for the HTTP/REST side of services that also expose gRPC, or for HTTP-gateway-fronted gRPC.
- **k6** / **gatling** — gRPC support varies (k6 has a gRPC module); `ghz` is the gRPC-specific choice.
- **pact-contract-testing** — Pact has protobuf support; useful for cross-team gRPC contracts.
- **wiremock** — does not virtualize gRPC; for gRPC virtualization see tools like `mockery` or `grpcmock`.
- **ci-test-orchestration** — for wiring `buf breaking` + in-process + smoke layers in the right order.
- **production-testing** — synthetic gRPC probes for production monitoring.
- **chaos-engineering** — testing how the service behaves under failed downstream gRPC dependencies.
