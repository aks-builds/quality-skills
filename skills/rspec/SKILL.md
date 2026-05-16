---
name: rspec
description: When the user wants to design, implement, debug, or optimize RSpec tests in Ruby. Use when the user mentions "RSpec," "describe/context/it," "let," "subject," "shared_examples," "shared_context," "expect(...).to eq," "rspec-rails," "FactoryBot," "VCR," "WebMock," "Capybara," ".rspec," "rspec --tag," or "rspec spec_helper.rb." For Rails system tests see also accessibility-testing and visual-regression. For JS/TS see jest-vitest. For Python see pytest. For Java see junit-testng.
metadata:
  version: 1.0.0
---

# RSpec

You are an expert in RSpec — Ruby's de facto behavior-driven test framework — and the surrounding ecosystem (FactoryBot, VCR, WebMock, Capybara, rspec-rails). Your goal is to help engineers structure specs cleanly, manage test data and time, mock effectively, and integrate with Rails / Sinatra / Hanami. Don't fabricate RSpec matchers, expectation method names, or gem APIs. When uncertain, point the reader to `rspec.info` and the relevant gem docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **RSpec major version** — RSpec 3.x is current. Older suites on RSpec 2 have meaningful API differences.
- **Framework** — Rails (use `rspec-rails`), Sinatra, Hanami, pure Ruby library.
- **Test data** — FactoryBot (formerly factory_girl) is the de facto factory library; fixtures still appear in legacy Rails apps.
- **HTTP mocking** — `webmock` (block real HTTP) and `vcr` (record-and-replay) are the standard pairing.
- **Browser tests** — Capybara + a driver (Selenium / Cuprite / Apparition). For non-Rails system tests, the stack is similar.
- **Test scope** — model / request / system specs, or pure Ruby unit specs.

If the file does not exist, ask: Ruby version, framework, RSpec version, FactoryBot or fixtures, browser-test stack if any.

---

## Why RSpec

- **Expressive describe / context / it structure** — reads close to spec language.
- **Rich matcher DSL** — `expect(x).to eq(y)`, `to include(...)`, `to change { ... }.by(1)`.
- **let / subject** — lazy fixtures, scoped per example.
- **Shared examples and contexts** — reuse common behavior across describes.
- **Tight Rails integration** — `rspec-rails` provides request specs, system specs, model specs.

When *not* to use RSpec:

- Non-Ruby code → use the host language's testing tool.
- Team prefers stdlib `Minitest` for less metaprogramming overhead → Minitest is also valid in Ruby, especially in Rails ecosystem (DHH's preference).

---

## Spec anatomy

```ruby
# spec/models/email_validator_spec.rb
require 'rails_helper'  # or 'spec_helper' for pure Ruby

RSpec.describe EmailValidator do
  subject(:validator) { described_class.new }

  describe '#valid?' do
    it 'accepts a well-formed address' do
      expect(validator.valid?('qa.user@example.com')).to be true
    end

    context 'with malformed input' do
      %w[no-at @only double@@at.com].each do |bad|
        it "rejects #{bad.inspect}" do
          expect(validator.valid?(bad)).to be false
        end
      end
    end
  end
end
```

| Block | Use |
|-------|-----|
| `describe` | Group examples for a class / method. |
| `context` | Sub-group for a specific scenario / state. |
| `it` / `specify` / `example` | One example. |
| `before(:each)` / `before(:all)` | Setup hooks. |
| `after(:each)` / `after(:all)` | Teardown hooks. |
| `let(:name) { ... }` | Lazy memoized value, scoped per example. |
| `let!(:name) { ... }` | Eager-evaluated `let` (runs in `before`). |
| `subject` / `subject(:name)` | The thing under test. |
| `shared_examples` / `it_behaves_like` | Reusable specs. |
| `shared_context` / `include_context` | Reusable setup. |

---

## Matchers

| Matcher | Use |
|---------|-----|
| `eq(x)` | Equality (`==`). |
| `eql(x)` | Strict equality (`===` and type). |
| `equal(x)` / `be(x)` | Object identity. |
| `be_truthy` / `be_falsey` / `be_nil` | Truthy / falsey / nil. |
| `be_<predicate>` | Matches a method ending in `?` (e.g., `be_valid` calls `valid?`). |
| `have_attributes(name: 'x', email: ...)` | Multi-attribute. |
| `match(/regex/)` | String / array regex. |
| `include(x)` / `include(a, b)` | Membership. |
| `contain_exactly(...)` | Array equality ignoring order. |
| `raise_error(MyError, /message/)` | Exception assertion. |
| `change { x }.by(1)` | Side effect. |
| `change { x }.from(a).to(b)` | Side effect with before/after. |
| `output(/text/).to_stdout` | Captured stdout. |

Custom matchers via `RSpec::Matchers.define`.

---

## `let`, `subject`, and scoping

`let` is lazy and memoized per example:

```ruby
let(:user) { User.create!(email: 'qa.user@example.com') }

it 'has an email' do
  expect(user.email).to eq('qa.user@example.com')  # creates here
end

it 'has an id' do
  expect(user.id).to be_present  # creates anew in this example
end
```

`let!(:user)` runs in `before` — eager, useful when the value must exist regardless of whether the example references it (e.g., a DB row needed for a count assertion).

`subject` is RSpec's convention for the thing under test:

```ruby
subject(:order) { build(:order, total: 1999) }
```

Implicit `is_expected.to` reads on the implicit subject:

```ruby
describe Order do
  subject { build(:order, total: 1999) }
  it { is_expected.to be_valid }
end
```

Use sparingly — implicit subject can hide what's being tested.

---

## FactoryBot

```ruby
# spec/factories/orders.rb
FactoryBot.define do
  factory :order do
    total { 1999 }
    placed_at { Time.current }

    trait :large do
      total { 999_999 }
    end

    factory :paid_order do
      paid_at { Time.current }
    end
  end
end

# in a spec
let(:order) { create(:order, :large, total: 5_000) }
```

`build` returns an unsaved object; `create` saves it; `build_stubbed` creates a fake-saved object without hitting the DB (much faster for tests that don't need persistence).

Avoid huge factories with many associations — each unrelated association adds DB cost.

---

## HTTP mocking: WebMock + VCR

```ruby
# spec/support/webmock.rb
require 'webmock/rspec'
WebMock.disable_net_connect!(allow_localhost: true)
```

WebMock blocks real HTTP by default; tests that try to hit the network fail loudly. Stub specific requests:

```ruby
stub_request(:post, 'https://billing.example.com/charge')
  .with(body: hash_including(amount: 1999))
  .to_return(status: 201, body: { id: 'ch_synthetic' }.to_json, headers: { 'Content-Type' => 'application/json' })
```

VCR records real HTTP once and replays from "cassettes" on subsequent runs:

```ruby
VCR.use_cassette('billing_charge') do
  process_order(order_id: 'ord-1')
end
```

Useful for third-party APIs. **Always review committed cassettes** — they contain real headers and may include secrets if the original call had them.

---

## Time control

```ruby
# Using ActiveSupport::Testing::TimeHelpers (Rails)
include ActiveSupport::Testing::TimeHelpers

it 'expires after 24 hours' do
  travel_to Time.parse('2026-01-01 00:00:00 UTC') do
    token = generate_token
    travel 25.hours
    expect(token).to be_expired
  end
end

# Using Timecop (gem)
Timecop.freeze(Time.parse('2026-01-01')) do
  # ...
end
```

Don't use `sleep` for time-related tests; freeze / travel time.

---

## Rails-specific specs

`rspec-rails` provides:

- **Model specs** — pure ActiveRecord behavior tests.
- **Request specs** — full Rails stack via `get`, `post`, `put`, `patch`, `delete` against a real router. **Recommended over the older controller specs.**
- **System specs** — Capybara-backed browser tests for end-to-end UI behavior.
- **Mailer / Job / Channel specs** — domain-specific.

```ruby
# Request spec
RSpec.describe 'POST /checkout', type: :request do
  let(:headers) { { 'Authorization' => 'Bearer bearer-token-placeholder' } }

  it 'returns 201' do
    post '/checkout', params: { sku: 'sku-001', qty: 1 }.to_json,
                       headers: headers.merge('Content-Type' => 'application/json')
    expect(response).to have_http_status(:created)
    expect(response.parsed_body).to include('order_id')
  end
end
```

---

## Configuration

```ruby
# spec/spec_helper.rb (pure ruby) or spec/rails_helper.rb (Rails)
RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect  # only :expect (not :should)
    c.max_formatted_output_length = 1000
  end

  config.example_status_persistence_file_path = 'tmp/rspec_examples.txt'  # for --next-failure / --only-failures
  config.order = :random
  config.profile_examples = 10   # log slowest 10
  config.filter_run_when_matching :focus  # use `it :focus do` for ad-hoc focus
end
```

---

## Running

| Command | Purpose |
|---------|---------|
| `rspec` | Run all specs. |
| `rspec spec/models/order_spec.rb` | One file. |
| `rspec spec/models/order_spec.rb:42` | Spec at line 42. |
| `rspec --tag smoke` | Tagged with `:smoke`. |
| `rspec --tag ~slow` | Excluding `:slow`. |
| `rspec --only-failures` | Re-run last failures. |
| `rspec --next-failure` | One failure at a time. |
| `rspec --format documentation` | Verbose. |
| `rspec --format JUnit --out report.xml` (via `rspec_junit_formatter`) | CI integration. |

Verify flags with `rspec --help` against your installed version.

---

## Parallel runs

The Ruby community uses two main approaches:

- **`parallel_tests`** — splits the suite across multiple processes locally.
- **CI sharding** — multiple workers each running a subset (using `parallel_tests` or `rspec-queue`).

In Rails, `parallel_tests` needs DB strategies that isolate per worker (`parallel_tests:db:setup` creates `myapp_test1`, `myapp_test2`, etc.).

---

## Common Pitfalls

- **`should` syntax** — deprecated. Always use `expect(...).to ...`.
- **Heavy `before(:all)`** — state leaks across examples. Default to `before(:each)` and `let`.
- **`let!` everywhere** — defeats laziness. Use only when needed (counts, ordering).
- **Implicit `subject` with complex setups** — hides what's being tested. Name the subject.
- **Hitting the network unintentionally** — always `WebMock.disable_net_connect!(allow_localhost: true)`.
- **Committing VCR cassettes with real secrets** — scrub before commit; configure VCR's `filter_sensitive_data`.
- **Order-dependent specs** — `config.order = :random` surfaces these; fix them, don't disable random order.
- **Massive factory associations** — every `let(:order)` creates a cascade of dependencies. Use `build_stubbed` where DB isn't needed.
- **Mixing controller specs and request specs** — controller specs are deprecated; migrate.
- **`sleep` in specs** — replaces with proper time/HTTP mocking or polling.

---

## Task-Specific Questions

When helping with RSpec, ask:

1. Ruby version and RSpec version?
2. Rails, Sinatra, Hanami, or pure Ruby?
3. FactoryBot or fixtures?
4. Browser tests in scope (Capybara + which driver)?
5. HTTP mocking strategy — WebMock, VCR, both?
6. Parallel test runs — `parallel_tests`, `rspec-queue`, or single-process?
7. CI reporter — JUnit, RSpec docs format, Allure?

---

## Related Skills

- **jest-vitest** — JS/TS equivalent.
- **pytest** — Python equivalent.
- **junit-testng** — JVM equivalent.
- **xunit-nunit** — .NET equivalent.
- **go-test** — Go equivalent.
- **cypress** / **playwright** — when RSpec system specs grow expensive, consider moving E2E to a JS-based runner.
- **mutation-testing** — `mutant` is the Ruby tool.
- **code-coverage** — SimpleCov.
- **flaky-test-management** — when order randomization surfaces dependencies.
- **ci-test-orchestration** — for `parallel_tests` and matrix sharding.
