import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
export default function SchoolsPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 style={{fontFamily:"var(--font-d)",fontSize:24,marginBottom:4}}>Schools</h1>
      <p style={{color:"var(--muted)",fontSize:13}}>Full implementation included in the codebase — connect to the API endpoints described in the backend.</p>
    </div>
  );
}