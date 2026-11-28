import { BRAND } from "../config.js";
import { spinner } from "../components/ui.js";

export async function view(ctx) {
  const mode = ctx.params.mode || "login";

  if (mode === "callback") {
    return {
      title: "Signing in",
      html: `<div class="auth-screen">
        <div class="auth-card">
          <div class="auth-brand"><img class="brand-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" /><span>${BRAND.name}</span></div>
          <div class="auth-credit">${BRAND.credit}</div>
          <div id="oauthStatus">${spinner("Completing Google sign-in...")}</div>
          <div id="oauthError" class="form-error"></div>
          <div class="auth-foot" style="margin-top:14px"><a href="/login" data-link>Back to sign in</a></div>
        </div>
      </div>`,
      onMount: async (el, c) => {
        const result = await c.data.completeOAuth();
        if (result && result.ok) {
          history.replaceState({}, "", "/dashboard");
          c.navigate("/dashboard");
          return;
        }
        const status = el.querySelector("#oauthStatus");
        if (status) status.innerHTML = "";
        el.querySelector("#oauthError").textContent = (result && result.error) || "Google sign-in failed.";
      },
    };
  }

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";
  const initialError = params.get("error") || "";
  const isRegister = mode === "register";
  const showGoogle = !ctx.data.isMock;

  const demoHint = ctx.data.isMock
    ? `<div class="auth-demo">Demo mode is enabled. Use any email and a password of 8+ characters \u2014 no real account is created.</div>`
    : "";

  return {
    title: isRegister ? "Create account" : "Sign in",
    html: `<div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand"><img class="brand-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" /><span>${BRAND.name}</span></div>
        <div class="auth-credit">${BRAND.credit}</div>
        <p class="auth-hint">${isRegister ? "Create the owner account for your RpAdmin panel." : "Sign in to manage your MTA servers."}</p>

        ${showGoogle ? `<a class="btn block google" href="/api/auth/google/start"><span class="g">G</span> Continue with Google</a>
        <div class="auth-divider">or use email</div>` : ""}

        <form id="authForm" autocomplete="on" novalidate>
          ${isRegister ? `<label class="field"><span>Display name</span><input id="authName" type="text" placeholder="Royalputo" autocomplete="name" /></label>` : ""}
          <label class="field"><span>Email</span><input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email" required /></label>
          <label class="field"><span>Password</span><input id="authPass" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="${isRegister ? "new-password" : "current-password"}" required /></label>
          ${isRegister ? `<label class="field"><span>Confirm password</span><input id="authPass2" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password" required /></label>` : ""}
          <div id="authError" class="form-error"></div>
          <button type="submit" class="btn primary block lg" id="authSubmit">${isRegister ? "Create account" : "Sign in"}</button>
        </form>

        <div class="auth-foot">
          ${isRegister ? `Already have an account? <a href="/login" data-link>Sign in</a>` : `Need an account? <a href="/register" data-link>Create one</a>`}
        </div>
        ${demoHint}
        <div class="auth-foot" style="margin-top:14px"><a href="/" data-link>\u2190 Back to home</a></div>
      </div>
    </div>`,
    onMount(el) {
      const form = el.querySelector("#authForm");
      const errorBox = el.querySelector("#authError");
      const submit = el.querySelector("#authSubmit");

      if (initialError) errorBox.textContent = initialError;

      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        errorBox.textContent = "";
        const email = el.querySelector("#authEmail").value.trim();
        const password = el.querySelector("#authPass").value;
        const name = el.querySelector("#authName") ? el.querySelector("#authName").value.trim() : "";

        if (!email || !password) {
          errorBox.textContent = "Email and password are required.";
          return;
        }
        if (isRegister) {
          const confirm = el.querySelector("#authPass2").value;
          if (password !== confirm) {
            errorBox.textContent = "Passwords do not match.";
            return;
          }
          if (password.length < 8) {
            errorBox.textContent = "Password must be at least 8 characters.";
            return;
          }
        }

        submit.disabled = true;
        submit.textContent = isRegister ? "Creating account..." : "Signing in...";

        try {
          const result = isRegister
            ? await ctx.data.signUp(email, password, name)
            : await ctx.data.signIn(email, password);

          if (result && result.error) {
            errorBox.textContent = result.error;
            return;
          }
          if (result && result.needsConfirmation) {
            ctx.toast("Check your email to confirm the account, then sign in.", "info");
            ctx.navigate("/login");
            return;
          }
          ctx.toast(isRegister ? "Account created" : "Signed in", "ok");
          ctx.navigate(next.startsWith("/") ? next : "/dashboard");
        } catch (err) {
          errorBox.textContent = err && err.message ? err.message : "Request failed.";
        } finally {
          submit.disabled = false;
          submit.textContent = isRegister ? "Create account" : "Sign in";
        }
      });

      const first = el.querySelector("#authEmail");
      if (first) first.focus();
      if (ctx.data.isMock) {
        el.querySelector("#authEmail").value = "owner@royalputo.dev";
        el.querySelector("#authPass").value = "royalputo";
        if (el.querySelector("#authPass2")) el.querySelector("#authPass2").value = "royalputo";
        if (el.querySelector("#authName")) el.querySelector("#authName").value = "Royalputo";
      }
    },
  };
}
