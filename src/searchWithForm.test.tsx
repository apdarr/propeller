import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchForm from "./searchWithForm";

// Mock Raycast API imports
jest.mock("@raycast/api", () => ({
  showToast: jest.fn(),
  Toast: { Style: { Failure: "failure" } },
  useNavigation: () => ({ push: jest.fn(), pop: jest.fn() }),
  getPreferenceValues: () => ({ defaultVersion: "free-pro-team@latest" })
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve(
      [
        JSON.stringify({ chunkType: "MESSAGE_CHUNK", text: "Test answer." }),
        JSON.stringify({ chunkType: "SOURCES", sources: [{ url: "https://docs.github.com/test-source" }] })
      ].join("\n")
    )
  })
) as jest.Mock;

describe("SearchForm", () => {
  it("renders the form and submits a query", async () => {
    render(<SearchForm />);
    const textarea = screen.getByPlaceholderText(/How do I configure OpenID Connect/i);
    fireEvent.change(textarea, { target: { value: "What is GitHub Copilot?" } });
    fireEvent.submit(textarea);
    // Should show loading state
    await waitFor(() => expect(screen.getByText(/Searching GitHub docs/i)).toBeInTheDocument());
    // Should show answer
    await waitFor(() => expect(screen.getByText(/Test answer/i)).toBeInTheDocument());
    // Should show source link
    await waitFor(() => expect(screen.getByText(/Test Source/i)).toBeInTheDocument());
  });

  it("shows error if query is empty", async () => {
    render(<SearchForm />);
    const textarea = screen.getByPlaceholderText(/How do I configure OpenID Connect/i);
    fireEvent.change(textarea, { target: { value: "" } });
    fireEvent.submit(textarea);
    // Should call showToast with failure
    await waitFor(() => {
      const { showToast } = require("@raycast/api");
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ style: "failure" }));
    });
  });
});
