import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { supabase } from "@/lib/supabase";
import logoImg from "@/assets/login/logo.png";
import Silk from "@/components/Silk";
import "./Login.css";

const BRAND_DARK = "#0d2543";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) throw signInError;
      if (!data.user) throw new Error("No user returned from login");

      try {
        await supabase.from("activity_events").insert({
          user_id: data.user.id,
          event_type: "LOGIN",
          metadata: { source: "web_app" },
        });
      } catch {
        // Non-blocking login tracking
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, must_reset_pw")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData.must_reset_pw) {
        navigate("/update-password");
      } else {
        navigate(`/${profileData.role}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid login credentials";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      {/* Silk animated background */}
      <div className="login-silk-bg">
        <Silk
          speed={5}
          scale={1}
          color={BRAND_DARK}
          noiseIntensity={1.5}
          rotation={0}
        />
      </div>

      {/* Centered glassmorphic sign-in card */}
      <div className="login-card-container">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="login-card"
          onSubmit={handleSubmit}
        >
          {/* Logo */}
          <div className="login-logo-wrapper">
            <ImageWithFallback
              src={logoImg}
              alt="SafetyCatch"
              className="login-logo-img"
            />
          </div>

          {/* Header */}
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Please enter your details to sign in</p>
          </div>

          {/* Error message */}
          {error && <div className="login-error">{error}</div>}

          {/* Email */}
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Options row */}
          <div className="login-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="forgot-password">
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          {/* Footer */}
          <p className="login-footer">
            © Safety Catch Training & Consulting Pvt. Ltd.
          </p>
        </motion.form>
      </div>
    </div>
  );
}
