---
name: selenium
description: When the user wants to design, implement, debug, or migrate Selenium WebDriver tests. Use when the user mentions "Selenium," "Selenium 4," "WebDriver," "Selenium Grid," "Selenium Manager," "BiDi," "By.id," "By.cssSelector," "WebDriverWait," "ExpectedConditions," "RemoteWebDriver," "DesiredCapabilities," "W3C capabilities," "ChromeDriver," "geckodriver," or "page object model." For Cypress-specific questions see cypress. For Playwright-specific questions see playwright. For grid infrastructure see selenium-grid. For cloud-hosted grids see cloud-test-grids.
metadata:
  version: 1.0.0
---

# Selenium

You are an expert in Selenium WebDriver (Selenium 4.x). Your goal is to help engineers design, implement, and stabilize Selenium tests — locators, waits, page objects, grid execution, and migration from Selenium 3 / legacy capabilities — without fabricating method signatures, capability names, or CLI flags. When unsure, point the reader to `selenium.dev` for the version they are running.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Languages used for tests** — Selenium has official bindings for Java, Python, JavaScript (Node), C# (.NET), and Ruby. API shape is consistent but idiomatic differences exist. Default examples in this skill use Java; ask before assuming.
- **Browsers in scope** — Selenium drives Chrome, Edge, Firefox, Safari (Safari requires `safaridriver` enabled on macOS), and Internet Explorer Mode in Edge. It is the only mainstream tool with first-class IE-mode support.
- **Selenium version** — Selenium 4.x is current. Selenium 3 used the legacy JSON Wire Protocol; Selenium 4 is W3C-only and changed how capabilities work. Always confirm the version before guiding code.
- **Grid usage** — local, self-hosted Selenium Grid 4, or a cloud provider (BrowserStack / Sauce Labs / LambdaTest). Capabilities and endpoints differ.

If the file does not exist, ask: language binding, Selenium version, target browsers, and whether tests run locally or against a grid.

---

## Why Selenium

- **Multi-language, multi-browser** — same protocol across every major language and browser.
- **W3C WebDriver standard** — broadest interop with cloud grids and browser vendors.
- **IE-mode support** — only mainstream tool that drives IE 11 / Edge IE Mode reliably.
- **Mature ecosystem** — page object libraries, reporting integrations, grid implementations.

When *not* to use Selenium:

- Single-stack JS/TS team starting fresh and wanting in-browser ergonomics → Cypress.
- Modern multi-browser including WebKit, with tracing → Playwright.
- Native mobile → Appium (which sits on top of WebDriver) or Espresso/XCUITest.

---

## Architecture

| Concept | Role |
|---------|------|
| **WebDriver** | A protocol (W3C) and a client library. The client sends JSON commands to a driver. |
| **Browser driver** | `chromedriver`, `geckodriver`, `msedgedriver`, `safaridriver`. Translates WebDriver commands into browser actions. |
| **Selenium Manager** | Built into Selenium 4.6+. Automatically downloads matching drivers — usually means you no longer manage drivers manually. |
| **Selenium Grid** | A hub + nodes cluster for distributed/parallel browser execution. See the selenium-grid skill. |
| **RemoteWebDriver** | A WebDriver that talks to a remote URL instead of a local driver. Used for grid and cloud providers. |

---

## Capabilities (W3C)

Selenium 4 uses W3C capabilities. Vendor options live under a `goog:chromeOptions`, `moz:firefoxOptions`, `ms:edgeOptions` prefix.

```java
ChromeOptions options = new ChromeOptions();
options.addArguments("--headless=new", "--window-size=1280,720");
options.setAcceptInsecureCerts(true);
WebDriver driver = new ChromeDriver(options);
```

For RemoteWebDriver against a grid or cloud:

```java
ChromeOptions options = new ChromeOptions();
WebDriver driver = new RemoteWebDriver(
    new URL("https://grid.example.com/wd/hub"), options);
```

Legacy `DesiredCapabilities` from Selenium 3 still compiles but is deprecated — convert to browser-specific options classes.

---

## Locators

| Locator | When to use |
|---------|-------------|
| `By.id(...)` | Stable element ID — fastest. |
| `By.cssSelector(...)` | Default choice for almost everything else. |
| `By.linkText(...)` / `By.partialLinkText(...)` | Anchor tags by visible text. |
| `By.xpath(...)` | When CSS can't reach the element (text-based selection, parent/ancestor traversal). |
| `By.tagName(...)` / `By.className(...)` / `By.name(...)` | Rarely the right choice — usually too brittle. |
| `RelativeBy` (`with(By...).above(...)`, `.toRightOf(...)`, etc.) | Spatial relations — niche. |

Prefer stable hooks (IDs, `data-test` attributes) over visual selectors. Avoid long XPath chains with positional indexes — they break on the slightest DOM change.

---

## Waits

Selenium has three categories of waits. **Pick one per project and stick with it.**

### Explicit waits (recommended)

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement signIn = wait.until(ExpectedConditions.elementToBeClickable(
    By.cssSelector("[data-test='sign-in']")));
signIn.click();
```

### Fluent waits

```java
Wait<WebDriver> wait = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(10))
    .pollingEvery(Duration.ofMillis(250))
    .ignoring(NoSuchElementException.class);
```

### Implicit waits

```java
driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(5));
```

**Do not mix implicit and explicit waits in the same suite** — the interaction is unpredictable and is a major source of flake. Pick explicit; remove any implicit wait calls.

`Thread.sleep` / `time.sleep` / `setTimeout` is almost always wrong. Use waits.

---

## Page Object Model

A page object encapsulates the structure of one page (or component) so tests can speak in domain terms.

```java
public class LoginPage {
    private final WebDriver driver;
    private final WebDriverWait wait;

    @FindBy(css = "[data-test='email']")  private WebElement email;
    @FindBy(css = "[data-test='password']") private WebElement password;
    @FindBy(css = "[data-test='sign-in']") private WebElement signIn;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        PageFactory.initElements(driver, this);
    }

    public DashboardPage signInAs(String emailValue, String passwordValue) {
        email.sendKeys(emailValue);
        password.sendKeys(passwordValue);
        signIn.click();
        return new DashboardPage(driver);
    }
}
```

Tests then read like spec text:

```java
new LoginPage(driver).signInAs("qa.user@example.com", "Pa$$w0rd-fake");
```

Avoid mega-page-objects with 50 methods — split by section / component.

---

## Selenium 4 features worth knowing

- **Selenium Manager** — auto-downloads the right driver. No more `WebDriverManager.chromedriver().setup()`.
- **W3C BiDi** — bidirectional protocol giving you network interception, console log capture, and JS exception listening directly. Still evolving; check current support per language binding.
- **Relative locators** — `above`, `below`, `toLeftOf`, `toRightOf`, `near`. Niche.
- **CDP (Chrome DevTools Protocol)** — via `((HasDevTools) driver).getDevTools()`. Lets you intercept network, emulate geolocation, throttle CPU. Chrome/Edge only.
- **Window/tab management** — `driver.switchTo().newWindow(WindowType.TAB / WINDOW)`.

---

## Running tests

There is no single Selenium CLI — you run tests via the test runner of your language (JUnit / TestNG / pytest / Mocha / NUnit / RSpec). Example:

| Language | Typical command |
|----------|-----------------|
| Java + Maven | `mvn -Dtest=LoginIT test` |
| Java + Gradle | `./gradlew test --tests "LoginIT"` |
| Python | `pytest tests/test_login.py` |
| JS / Node | `npx mocha tests/login.spec.js` |
| .NET | `dotnet test --filter "FullyQualifiedName~Login"` |

For grid execution, point `RemoteWebDriver` at the hub URL. For cloud providers (BrowserStack / Sauce / LambdaTest), use their cloud capabilities namespace and provided endpoint — see the cloud-test-grids skill.

---

## Headless and CI

```java
ChromeOptions options = new ChromeOptions();
options.addArguments("--headless=new");          // current headless mode for Chrome/Edge
options.addArguments("--no-sandbox");            // for Docker / root contexts
options.addArguments("--disable-dev-shm-usage"); // for Docker on small /dev/shm
options.addArguments("--window-size=1280,720");
```

In CI, prefer the official Selenium Docker images (`selenium/standalone-chrome`, `selenium/standalone-firefox`) for reproducibility. Pin a version tag — `latest` drifts.

---

## Common Pitfalls

- **Mixing implicit + explicit waits** — pick one (explicit), remove the other.
- **Using `Thread.sleep`** — replace with `WebDriverWait` + `ExpectedConditions`.
- **Brittle XPath with absolute paths** — `/html/body/div[2]/div[3]/...` breaks constantly. Use CSS or text-based predicates.
- **Stale element references** — re-find the element after the DOM changes. Don't cache `WebElement` across navigations.
- **Treating Selenium 3 capabilities as Selenium 4** — the JSON Wire Protocol is gone; `DesiredCapabilities` is deprecated. Migrate to `*Options` classes.
- **Forgetting `driver.quit()` in CI** — leaks browsers and runners. Use a test-runner lifecycle hook (`@After` / fixture finalizer).
- **Not pinning driver / browser versions** — Selenium Manager helps for drivers, but the browser version still varies; pin in Docker.
- **Page objects that return the same page object** — every action should return whatever page the user lands on. Lying about return types misleads readers.
- **Page objects with assertions** — assertions belong in the test, not the page object. The PO models the page; the test models the expectation.

---

## Task-Specific Questions

When helping with Selenium, ask:

1. Which language binding — Java, Python, JS, C#, Ruby?
2. Selenium version — 4.x (assume yes unless told otherwise; warn loudly about 3.x).
3. Target browsers — and any IE-mode requirement?
4. Local-only, self-hosted Grid, or cloud provider?
5. Headless or headed in CI?
6. Test runner — JUnit / TestNG / pytest / Mocha / NUnit?
7. Existing page-object structure, or starting fresh?

---

## Related Skills

- **selenium-grid** — for hub/node setup, Kubernetes deployment, and node sizing.
- **cloud-test-grids** — for BrowserStack / Sauce Labs / LambdaTest capability formats.
- **playwright** — when comparing or migrating, especially for trace-driven debugging or WebKit coverage.
- **cypress** — when comparing for in-browser JS-only stacks.
- **appium** — Appium is built on WebDriver; Selenium patterns transfer naturally.
- **flaky-test-management** — when waits are not the actual root cause.
- **ci-test-orchestration** — for sharding and matrix execution against Grid or cloud.
