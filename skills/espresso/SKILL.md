---
name: espresso
description: When the user wants to design, implement, debug, or stabilize Espresso tests for native Android UI automation. Use when the user mentions "Espresso," "onView," "ViewMatchers," "withId," "IdlingResource," "ActivityScenario," "ActivityScenarioRule," "AndroidJUnitRunner," "androidx.test," "instrumented tests," "Espresso Intents," "Espresso Web," or "@RunWith(AndroidJUnit4)." For cross-platform mobile see appium. For iOS-native see xcuitest. For React Native see detox. For YAML-driven flows see maestro.
metadata:
  version: 1.0.0
---

# Espresso (Android)

You are an expert in Espresso — Google's native Android UI testing framework. Your goal is to help engineers write fast, reliable Espresso tests, manage async work via IdlingResources, and integrate the instrumented tests with the Android build. Don't fabricate Espresso method names, ViewMatcher / ViewAction names, or AndroidX Test artifact names. When uncertain, point the reader to `developer.android.com/training/testing` and the AndroidX Test docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Android-only?** — Espresso is Android-specific. For cross-platform, mention Appium as the alternative.
- **Language** — Java or Kotlin. Both supported; idiomatic Kotlin tests use `androidx.test.ext.junit.runners.AndroidJUnit4` and `ActivityScenario`.
- **Architecture under test** — Espresso is great for UI behavior, weak for cross-process or system-UI interactions (use UiAutomator for those — often combined with Espresso).
- **Async work** — Espresso assumes synchronization with the main thread. Background work (network, RxJava, Coroutines) needs `IdlingResource` for stable tests.
- **Device target** — emulator (Firebase Test Lab, GitHub Actions Android emulator, local AVD) or real device (Firebase Test Lab, BrowserStack, AWS Device Farm).

If the file does not exist, ask: Java or Kotlin, what async libraries the app uses, target device strategy, and whether the app has been instrumented for `setHasTransientState` / IdlingResource cooperation.

---

## Why Espresso

- **In-process, gray-box** — Espresso runs in the same JVM as the app. Direct access to the activity tree, view hierarchy, and resources.
- **Auto-synchronization** — Espresso waits for the main thread to be idle before each command. No `sleep()`.
- **Fast** — by far the fastest Android UI testing option once tests are running.
- **Official** — Google-maintained, integrated with AndroidX Test.

When *not* to use Espresso:

- Multi-app flows (deep links to other apps, system settings, notifications) → combine with UiAutomator.
- Cross-platform requirement → Appium.
- React Native team that wants JS-side tests → Detox.

---

## Test setup

`app/build.gradle.kts` (or `.gradle`):

```kotlin
dependencies {
  androidTestImplementation("androidx.test.ext:junit:<pinned-version>")
  androidTestImplementation("androidx.test.espresso:espresso-core:<pinned-version>")
  androidTestImplementation("androidx.test:runner:<pinned-version>")
  androidTestImplementation("androidx.test:rules:<pinned-version>")
}

android {
  defaultConfig {
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }
}
```

Verify exact artifact versions against `developer.android.com/jetpack/androidx/releases/test`.

Tests live under `src/androidTest/` (instrumented) — distinct from `src/test/` (JVM unit tests, see jest-vitest / junit-testng analogues).

---

## Basic test

```kotlin
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LoginScreenTest {

  @get:Rule
  val activityScenarioRule = ActivityScenarioRule(LoginActivity::class.java)

  @Test
  fun signs_in_with_valid_credentials() {
    onView(withId(R.id.email)).perform(typeText("qa.user@example.com"), closeSoftKeyboard())
    onView(withId(R.id.password)).perform(typeText("Pa\$\$w0rd-fake"), closeSoftKeyboard())
    onView(withId(R.id.sign_in)).perform(click())
    onView(withId(R.id.welcome)).check(matches(isDisplayed()))
  }
}
```

Three building blocks:

1. **`onView(matcher)`** — locate a view.
2. **`.perform(action, ...)`** — drive an action (click, type, scroll).
3. **`.check(assertion)`** — assert on the view.

---

## View matchers (locators)

| Matcher | Use |
|---------|-----|
| `withId(R.id.x)` | Stable ID. First choice. |
| `withText("...")` / `withText(R.string.x)` | Visible text. |
| `withContentDescription("...")` | Accessibility text. |
| `withTagValue(...)` | View tag. |
| `withParent(...)` / `hasDescendant(...)` | Compose matchers for hierarchy. |
| `isDisplayed()` / `isEnabled()` / `isChecked()` | State predicates. |
| `allOf(m1, m2)` / `anyOf(...)` | Combine matchers. |

Strongly prefer `withId(...)` — IDs are deliberate, stable, and survive refactors better than text or tag.

---

## View actions

| Action | Use |
|--------|-----|
| `click()` / `doubleClick()` / `longClick()` | Touch events. |
| `typeText("...")` / `replaceText("...")` | Text input. `replaceText` is faster than `clearText().typeText(...)`. |
| `closeSoftKeyboard()` | Dismiss keyboard. |
| `scrollTo()` | Scroll the target into view. |
| `swipeLeft()` / `swipeRight()` / `swipeUp()` / `swipeDown()` | Swipes. |
| `pressBack()` | System back. |
| Custom via `ViewAction` interface | When built-ins don't fit. |

---

## RecyclerView

`RecyclerViewActions` (from `androidx.test.espresso:espresso-contrib`) provides matchers and actions for `RecyclerView` items:

```kotlin
onView(withId(R.id.product_list))
    .perform(RecyclerViewActions.actionOnItemAtPosition<MyViewHolder>(3, click()))

onView(withId(R.id.product_list))
    .perform(RecyclerViewActions.scrollTo<MyViewHolder>(hasDescendant(withText("Widget"))))
```

---

## IdlingResource — the most important concept

Espresso waits for the main thread to be idle. But async work (background fetches, RxJava, Coroutines) is invisible to that check. You'll get flaky tests where Espresso races past async work.

`IdlingResource` is the bridge — it tells Espresso "still working."

```kotlin
class HttpIdlingResource(private val httpClient: MyHttpClient) : IdlingResource {
  private var callback: IdlingResource.ResourceCallback? = null
  override fun getName(): String = "HttpIdlingResource"
  override fun isIdleNow(): Boolean {
    val idle = httpClient.inFlightCount() == 0
    if (idle) callback?.onTransitionToIdle()
    return idle
  }
  override fun registerIdleTransitionCallback(cb: IdlingResource.ResourceCallback) { callback = cb }
}
```

Register and unregister around tests:

```kotlin
@Before fun before() { IdlingRegistry.getInstance().register(httpIdlingResource) }
@After  fun after()  { IdlingRegistry.getInstance().unregister(httpIdlingResource) }
```

For modern apps using Coroutines, `CountingIdlingResource` is a simple counter; libraries like `okhttp-idling-resource` wrap OkHttp. Avoid `sleep` — IdlingResource is the right primitive.

---

## ActivityScenario and FragmentScenario

`ActivityScenario` launches and controls an activity in tests; `FragmentScenario` (from `androidx.fragment:fragment-testing`) does the same for fragments.

```kotlin
val scenario = ActivityScenario.launch(LoginActivity::class.java)
scenario.onActivity { activity ->
  // call methods on the actual activity instance
}
scenario.moveToState(Lifecycle.State.STARTED)
scenario.close()
```

These give you direct access to the activity/fragment under test — useful for state-setup that bypasses the UI.

---

## Intents

`Espresso-Intents` (`androidx.test.espresso:espresso-intents`) stubs and verifies `startActivity` calls:

```kotlin
@get:Rule val intentsRule = IntentsRule()

@Test fun opens_browser_on_help_click() {
  Intents.intending(hasAction(Intent.ACTION_VIEW)).respondWith(
    Instrumentation.ActivityResult(Activity.RESULT_OK, null)
  )
  onView(withId(R.id.help)).perform(click())
  intended(allOf(hasAction(Intent.ACTION_VIEW), hasData("https://support.example.com")))
}
```

Useful for tests that would otherwise launch external apps (browser, camera, mail).

---

## Running

| Command | Purpose |
|---------|---------|
| `./gradlew connectedAndroidTest` | Run all instrumented tests against a connected device/emulator. |
| `./gradlew :app:connectedDebugAndroidTest` | Specific build variant. |
| `./gradlew connectedAndroidTest -PandroidTestInstrumentationRunnerArguments.class=com.example.LoginScreenTest` | One test class. |

For CI:
- GitHub Actions has `reactivecircus/android-emulator-runner` (or equivalents) for emulator-on-CI.
- Firebase Test Lab is the standard managed option (run via `gcloud firebase test android run ...`).
- BrowserStack, AWS Device Farm, Sauce Labs all support Espresso APKs.

---

## Common Pitfalls

- **`Thread.sleep` instead of IdlingResource** — flake forever.
- **`withText` for buttons that get localized** — breaks the moment translations land. Use `withId` or `withText(R.string.x)`.
- **Testing animations directly** — disable system animations via developer options or via gradle test orchestration: `adb shell settings put global window_animation_scale 0` (also `transition_animation_scale`, `animator_duration_scale`).
- **Massive single-screen test methods** — split by behavior. Espresso tests are cheap to add.
- **Asserting on internal state from tests** — keep UI tests UI-shaped. For state, use instrumented integration tests or unit tests of the ViewModel.
- **Not pinning AndroidX Test versions** — subtle behavior changes between minor versions can flip flakiness.
- **Running unit tests under `connectedAndroidTest`** — unit tests belong in `src/test/`, run via `./gradlew test`. Mixing them slows the instrumented suite.
- **Forgetting `closeSoftKeyboard()` after `typeText`** — subsequent clicks land on the keyboard, not the target view.
- **Skipping the test orchestrator** — `androidx.test:orchestrator` runs each test in its own process; without it, leaked state cascades.

---

## Task-Specific Questions

When helping with Espresso, ask:

1. Java or Kotlin?
2. What async libraries does the app use (Coroutines, RxJava, OkHttp callbacks)?
3. Is there already an IdlingResource setup, or does it need to be added?
4. Where do tests run — local emulator, CI emulator, Firebase Test Lab, real device cloud?
5. Is the test orchestrator (`androidx.test:orchestrator`) in use?
6. Are there RecyclerViews / complex lists to test, requiring `espresso-contrib`?
7. Are there cross-app flows that need UiAutomator alongside Espresso?

---

## Related Skills

- **appium** — cross-platform alternative.
- **xcuitest** — iOS-native equivalent.
- **detox** — React Native gray-box alternative.
- **maestro** — YAML-driven, simpler, less powerful.
- **junit-testng** — JVM unit testing patterns (Espresso uses JUnit 4 under the hood; modern setups support JUnit 5 via runners).
- **ci-test-orchestration** — for parallelizing instrumented tests, Firebase Test Lab integration, sharding.
- **cloud-test-grids** — for managed Android device pools.
- **flaky-test-management** — when IdlingResources are not enough.
