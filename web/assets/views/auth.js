import { BRAND, CONFIG } from "../config.js";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve();
      return;
    }
    const existing = document.querySelector("script[data-rp-google]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Google sign-in")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.rpGoogle = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  });
}

export async function view(ctx) {
  const mode = ctx.params.mode === "register" ? "register" : "login";
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";
  const initialError = params.get("error") || "";
  const isRegister = mode === "register";
  const showGoogle = !ctx.data.isMock && !!CONFIG.GOOGLE_CLIENT_ID;

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

        ${showGoogle ? `<div id="googleSlot" class="google-slot"></div><div class="auth-divider">or use email</div>` : ""}

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
      const go = () => ctx.navigate(next.startsWith("/") ? next : "/dashboard");

      if (initialError) errorBox.textContent = initialError;

      if (showGoogle) {
        loadGoogleScript()
          .then(() => {
            if (!window.google || !window.google.accounts || !window.google.accounts.id) {
              throw new Error("Google sign-in is unavailable");
            }
            window.google.accounts.id.initialize({
              client_id: CONFIG.GOOGLE_CLIENT_ID,
              callback: async (response) => {
                if (!response || !response.credential) {
                  errorBox.textContent = "Google did not return a credential.";
                  return;
                }
                errorBox.textContent = "";
                try {
                  await ctx.data.googleSignIn(response.credential);
                  ctx.toast("Signed in with Google", "ok");
                  go();
                } catch (err) {
                  errorBox.textContent = err && err.message ? err.message : "Google sign-in failed.";
                }
              },
            });
            window.google.accounts.id.renderButton(el.querySelector("#googleSlot"), {
              theme: "filled_black",
              size: "large",
              shape: "rect",
              text: "continue_with",
              width: 320,
            });
          })
          .catch(() => {
            const slot = el.querySelector("#googleSlot");
            if (slot) slot.innerHTML = '<div class="role-note">Google sign-in is unavailable right now.</div>';
          });
      }

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
          go();
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
