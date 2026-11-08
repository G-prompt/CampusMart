"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { categories } from "@/lib/products";

const STORAGE_KEY = "campusmart-wanted-requests";

type WantedRequest = {
  id: string;
  title: string;
  category: string;
  budget: number | null;
  campus: string;
  details: string;
  requester: string;
  createdAt: string;
};

function isWantedRequest(value: unknown): value is WantedRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Partial<WantedRequest>;
  return (
    typeof request.id === "string" &&
    typeof request.title === "string" &&
    typeof request.category === "string" &&
    (request.budget === null || typeof request.budget === "number") &&
    typeof request.campus === "string" &&
    typeof request.details === "string" &&
    typeof request.requester === "string" &&
    typeof request.createdAt === "string"
  );
}

export default function WantedPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<WantedRequest[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Books");
  const [budget, setBudget] = useState("");
  const [campus, setCampus] = useState(
    user?.campus || user?.university?.shortName || user?.university?.name || ""
  );
  const [details, setDetails] = useState("");
  const [search, setSearch] = useState("");
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const campusLabel =
      user?.campus || user?.university?.shortName || user?.university?.name;

    if (campusLabel) {
      setCampus((current) => current || campusLabel);
    }
  }, [user]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

      if (!Array.isArray(saved) || !saved.every(isWantedRequest)) {
        throw new Error("Saved requests have an unexpected format.");
      }

      setRequests(saved);
    } catch (error) {
      console.error("Unable to load wanted requests:", error);
      setStorageError(
        "We couldn’t read the requests saved in this browser. You can still browse listings, but new requests may not save until browser storage is available."
      );
    }
  }, []);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) =>
      `${request.title} ${request.category} ${request.campus} ${request.details}`
        .toLowerCase()
        .includes(query)
    );
  }, [requests, search]);

  const saveRequests = (next: WantedRequest[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRequests(next);
      setStorageError("");
      return true;
    } catch (error) {
      console.error("Unable to save wanted request:", error);
      setStorageError(
        "This request couldn’t be saved in your browser. Check that local storage is available and try again."
      );
      return false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");

    const parsedBudget = budget.trim() ? Number(budget) : null;
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      setStorageError("Enter a budget greater than zero, or leave it blank.");
      return;
    }

    const request: WantedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      category,
      budget: parsedBudget,
      campus: campus.trim(),
      details: details.trim(),
      requester: user?.name?.trim() || "Campus student",
      createdAt: new Date().toISOString(),
    };

    if (saveRequests([request, ...requests])) {
      setTitle("");
      setBudget("");
      setDetails("");
      setNotice("Request saved on this device.");
    }
  };

  const removeRequest = (id: string) => {
    saveRequests(requests.filter((request) => request.id !== id));
  };

  return (
    <PageShell
      title="Wanted on campus"
      description="Looking for a textbook, a second-hand item, or a student service? Keep a request here and browse current listings while you wait."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="site-card p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A3D48]">
              Post a request
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              What are you looking for?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep it specific and don’t include your phone number, room number, or
              other private details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-bold text-slate-800">
              Item or service
              <input
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Second-hand engineering calculator"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none focus:border-[#8A3D48]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-800">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none focus:border-[#8A3D48]"
                >
                  {categories
                    .filter((item) => item !== "All")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Max budget (₦)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="Optional"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none focus:border-[#8A3D48]"
                />
              </label>
            </div>

            <label className="block text-sm font-bold text-slate-800">
              Campus
              <input
                maxLength={100}
                value={campus}
                onChange={(event) => setCampus(event.target.value)}
                placeholder="University or campus (optional)"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none focus:border-[#8A3D48]"
              />
            </label>

            <label className="block text-sm font-bold text-slate-800">
              More details (optional)
              <textarea
                maxLength={280}
                rows={3}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Condition, preferred version, timing..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-[#8A3D48]"
              />
            </label>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-950">
              Requests are stored only in this browser for now. They are not
              published to other students; a shared wanted board needs a backend
              endpoint.
            </div>

            {storageError ? (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {storageError}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-sm font-semibold text-emerald-700">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-400 px-5 text-sm font-black text-black transition hover:bg-accent-500"
            >
              Save request on this device
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A3D48]">
                Your local board
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {requests.length} {requests.length === 1 ? "request" : "requests"}
              </h2>
            </div>
            <label className="sr-only" htmlFor="wanted-search">
              Search saved requests
            </label>
            <input
              id="wanted-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm sm:w-52"
            />
          </div>

          {visibleRequests.length ? (
            <div className="space-y-3">
              {visibleRequests.map((request) => (
                <article key={request.id} className="site-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-[#8A3D48]">
                        {request.category}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">
                        {request.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRequest(request.id)}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                    {request.budget ? (
                      <span>Budget up to ₦{request.budget.toLocaleString()}</span>
                    ) : null}
                    {request.campus ? <span>{request.campus}</span> : null}
                    <span>Posted by {request.requester}</span>
                  </div>
                  {request.details ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {request.details}
                    </p>
                  ) : null}

                  <Link
                    href={`/marketplace/search?q=${encodeURIComponent(request.title)}`}
                    className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-800 transition hover:border-slate-400"
                  >
                    Search current listings
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="site-card p-7 text-center">
              <h3 className="font-black text-slate-950">
                {requests.length ? "No matching requests" : "Your board is empty"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {requests.length
                  ? "Try another search, or clear the search field."
                  : "Save what you’re looking for here, then check current listings for a match."}
              </p>
              <Link
                href="/marketplace"
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-accent-400 px-4 text-sm font-black text-black"
              >
                Browse marketplace
              </Link>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
