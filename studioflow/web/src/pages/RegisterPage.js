import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import Button from "../components/shared/Button";
import { Field, Input, Textarea } from "../components/shared/Field";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [form, setForm] = useState({
    ownerName: "",
    ownerEmail: "",
    schoolName: "",
    city: "",
    danceStyle: "",
  });

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Pre-fill Google data if redirected from Google login
  useEffect(() => {
    const googleData = location.state?.googleData;
    if (googleData) {
      setForm(prev => ({
        ...prev,
        ownerName: googleData.name || "",
        ownerEmail: googleData.email || "",
      }));
    }
  }, [location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!form.ownerEmail) {
      toast.error("Email is required");
      return false;
    }
    if (!form.ownerEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return false;
    }
    if (!form.ownerName.trim()) {
      toast.error("Owner name is required");
      return false;
    }
    if (!form.schoolName.trim()) {
      toast.error("School name is required");
      return false;
    }
    if (!agreeToTerms) {
      toast.error("You must agree to the Terms of Service and Privacy Policy");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          schoolName: form.schoolName,
          city: form.city || null,
          danceStyle: form.danceStyle || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const data = await response.json();

      // Log in the user with the returned token
      sessionStorage.setItem("sf_token", data.token);
      localStorage.setItem("sf_user", JSON.stringify(data.user));
      localStorage.setItem("sf_school", JSON.stringify(data.school));

      // Update auth context
      login(data.user, data.school, data.token);

      toast.success("School registered successfully!");
      navigate(`/dashboard/${data.school.id}/settings`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--card)",
        borderRadius: 16,
        padding: "40px 32px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 8px",
            color: "var(--text)",
          }}>
            Register Your School
          </h1>
          <p style={{
            fontSize: 14,
            color: "var(--muted)",
            margin: 0,
          }}>
            Get started with ManchQ in minutes
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <Field label="Owner Name" required>
            <Input
              type="text"
              name="ownerName"
              value={form.ownerName}
              onChange={handleChange}
              placeholder="Your full name"
              disabled={loading}
            />
          </Field>

          <Field label="Email" required>
            <Input
              type="email"
              name="ownerEmail"
              value={form.ownerEmail}
              onChange={handleChange}
              placeholder="your@email.com"
              disabled={loading}
            />
          </Field>

          <Field label="School Name" required>
            <Input
              type="text"
              name="schoolName"
              value={form.schoolName}
              onChange={handleChange}
              placeholder="e.g., Elite Dance Academy"
              disabled={loading}
            />
          </Field>

          <Field label="City">
            <Input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="e.g., New York"
              disabled={loading}
            />
          </Field>

          <Field label="Dance Style">
            <Input
              type="text"
              name="danceStyle"
              value={form.danceStyle}
              onChange={handleChange}
              placeholder="e.g., Classical, Contemporary, Hip-Hop"
              disabled={loading}
            />
          </Field>

          {/* Terms Acceptance */}
          <div style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "12px",
            background: "var(--surface)",
            borderRadius: 8,
            borderLeft: "3px solid var(--accent)",
          }}>
            <input
              type="checkbox"
              id="agreeToTerms"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              disabled={loading}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                cursor: loading ? "not-allowed" : "pointer",
                accentColor: "var(--accent)",
              }}
            />
            <label
              htmlFor="agreeToTerms"
              style={{
                fontSize: 12,
                color: "var(--text)",
                lineHeight: 1.5,
                cursor: loading ? "not-allowed" : "pointer",
                flex: 1,
              }}
            >
              I agree to ManchQ's{" "}
              <a
                href="/TERMS_OF_SERVICE.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--accent)",
                }}
              >
                Terms of Service
              </a>
              {" "}and{" "}
              <a
                href="/PRIVACY_POLICY.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--accent)",
                }}
              >
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Registering..." : "Register School"}
          </Button>
        </form>

        {/* Divider */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "24px 0",
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Already have account */}
        <div style={{
          textAlign: "center",
          fontSize: 13,
          color: "var(--muted)",
        }}>
          Already have a school?{" "}
          <a
            href="/login"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Sign in here
          </a>
        </div>
      </div>
    </div>
  );
}
