/**
 * The profile fetch, and the two ways it used to misbehave.
 *
 * supabase-js emits an auth event on every token refresh and, on web, on every
 * tab focus. The guard against refetching the profile row each time was keyed on
 * the row that came back — so an account without one never satisfied it and
 * refetched forever, which is how a deleted account produced four identical
 * "Failed to load user profile" errors per sign-in.
 *
 * And the fetch used single(), which throws on zero rows. No row is a state, not
 * a failure: it happens between signup and the handle_new_user trigger, and for
 * any account whose row was removed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// hoisted: vi.mock is lifted above the file's other statements, so plain consts
// would not exist yet when the factory runs.
const { maybeSingle, signOut, track, setAnalyticsUser } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  signOut: vi.fn(),
  track: vi.fn(),
  setAnalyticsUser: vi.fn(),
}));

// analytics reaches react-native and expo-constants, whose Flow sources vitest
// cannot parse. Mocked here rather than made lazy in the store: the store's job
// is auth, and the shape it depends on is these two functions.
vi.mock("../../services/analytics", () => ({ track, setAnalyticsUser }));

vi.mock("../../services/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
    auth: { signOut },
  },
}));

import { useAuthStore } from "../authStore";

/** Enough of a Session for setSession; only user.id and email are read. */
function sessionFor(id: string, email = "dev@example.com") {
  return { user: { id, email }, access_token: "t", refresh_token: "r" } as never;
}

beforeEach(() => {
  maybeSingle.mockReset();
  signOut.mockReset();
  track.mockReset();
  setAnalyticsUser.mockReset();
  useAuthStore.setState({
    user: null,
    session: null,
    profile: null,
    profileLoadedFor: null,
    initialized: false,
  });
});

describe("loading the profile", () => {
  it("stores the row when there is one", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "dev@example.com", subscription_tier: "free" },
      error: null,
    });

    await useAuthStore.getState().setSession(sessionFor("u1"));

    expect(useAuthStore.getState().profile?.id).toBe("u1");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("treats no row as a state rather than an error", async () => {
    // maybeSingle's shape for zero rows. single() gave {error: PGRST116} here,
    // which was thrown and logged as a failure.
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await useAuthStore.getState().setSession(sessionFor("u1"));

    expect(useAuthStore.getState().profile).toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("the refetch guard", () => {
  it("does not refetch on repeated auth events for the same user", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "dev@example.com", subscription_tier: "free" },
      error: null,
    });

    const store = useAuthStore.getState();
    await store.setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(sessionFor("u1"));

    // Token refresh and tab focus must not each cost a profiles?select=*.
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("still does not refetch when the user has no profile row", async () => {
    // The regression: keyed on profile.id, this refetched on every event
    // forever because there was never an id to match.
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().setSession(sessionFor("ghost"));
    await useAuthStore.getState().setSession(sessionFor("ghost"));
    await useAuthStore.getState().setSession(sessionFor("ghost"));

    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("does refetch for a different user", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "a@example.com", subscription_tier: "free" },
      error: null,
    });

    await useAuthStore.getState().setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(sessionFor("u2", "b@example.com"));

    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("retries after a thrown error, which may be transient", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "network down" } });
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "dev@example.com", subscription_tier: "free" },
      error: null,
    });

    await useAuthStore.getState().setSession(sessionFor("u1"));
    expect(useAuthStore.getState().profile).toBeNull();

    // A dropped connection must not cost the account its profile for the whole
    // session — unlike "no row", an error is not a definitive answer.
    await useAuthStore.getState().setSession(sessionFor("u1"));
    expect(useAuthStore.getState().profile?.id).toBe("u1");
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("signing out clears the record, so the next sign-in fetches again", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "u1", email: "dev@example.com", subscription_tier: "free" },
      error: null,
    });

    await useAuthStore.getState().setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().profile).toBeNull();

    await useAuthStore.getState().setSession(sessionFor("u1"));
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});

describe("analytics identity", () => {
  it("tells analytics who the user is, and forgets on sign-out", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().setSession(sessionFor("u1"));
    expect(setAnalyticsUser).toHaveBeenLastCalledWith("u1");

    await useAuthStore.getState().setSession(null);
    // Null, not stale: an event fired after sign-out must not be attributed to
    // the person who just left.
    expect(setAnalyticsUser).toHaveBeenLastCalledWith(null);
  });

  it("records a sign-in once per user, not once per token refresh", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(sessionFor("u1"));
    await useAuthStore.getState().setSession(sessionFor("u1"));
    // supabase-js emits an auth event on every refresh and every tab focus.
    // Counting those as sign-ins would make the funnel's first step meaningless.
    expect(track.mock.calls.filter((c) => c[0] === "signed_in")).toHaveLength(1);

    await useAuthStore.getState().setSession(sessionFor("u2", "b@example.com"));
    expect(track.mock.calls.filter((c) => c[0] === "signed_in")).toHaveLength(2);
  });
});
