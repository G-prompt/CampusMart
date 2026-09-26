"use client";

import {
  useEffect,
  useState,
} from "react";
import type {
  FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { categories } from "@/lib/products";

export default function Page() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] =
    useState("");

  const [category, setCategory] =
    useState("Technology");

  const [price, setPrice] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [error, setError] =
    useState("");

  const [publishing, setPublishing] =
    useState(false);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl =
      URL.createObjectURL(imageFile);

    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [imageFile]);

  const submit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError("");

    if (
      user?.role !== "vendor"
    ) {
      setError(
        "Sign in with a vendor account to publish a listing."
      );
      return;
    }

    const numericPrice =
      Number(price);

    if (
      !title.trim() ||
      !description.trim() ||
      !Number.isFinite(
        numericPrice
      ) ||
      numericPrice <= 0
    ) {
      setError(
        "Add a title, description, and valid price before publishing."
      );
      return;
    }

    const token =
      localStorage.getItem(
        "campusmart-token"
      );

    if (!token) {
      setError(
        "Your session could not be verified. Please sign in again."
      );
      return;
    }

    try {
      setPublishing(true);

      const formData =
        new FormData();

      formData.append(
        "title",
        title.trim()
      );

      formData.append(
        "category",
        category
      );

      formData.append(
        "price",
        String(numericPrice)
      );

      formData.append(
        "description",
        description.trim()
      );

      if (imageFile) {
        formData.append(
          "images",
          imageFile
        );
      }

      if (imageUrl.trim()) {
        formData.append(
          "imageUrl",
          imageUrl.trim()
        );
      }

      const apiUrl =
        process.env
          .NEXT_PUBLIC_API_URL ||
        "http://localhost:5000";

      const response =
        await fetch(
          `${apiUrl}/api/products`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Unable to publish listing."
        );
      }

      router.push(
        `/marketplace/products/${data.product.id}`
      );
    } catch (error) {
      console.error(
        "Publish listing error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to publish listing."
      );
    } finally {
      setPublishing(false);
    }
  };

  const displayPreview =
    previewUrl ||
    imageUrl.trim();

  return (
    <PageShell
      title="Add listing"
      description="Create a detailed product or service listing for campus buyers."
    >
      <form
        onSubmit={submit}
        className="site-card max-w-3xl space-y-5 p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Product or service name

            <input
              required
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
              placeholder="e.g. Calculus revision pack"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Category

            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            >
              {categories
                .filter(
                  (item) =>
                    item !== "All"
                )
                .map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Price in naira

          <input
            required
            type="number"
            min="1"
            value={price}
            onChange={(event) =>
              setPrice(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            placeholder="15000"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Description

          <textarea
            required
            rows={6}
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            placeholder="Describe condition, what is included, delivery or pickup details, and anything buyers should know."
          />
        </label>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Upload product picture

            <span className="ml-1 font-normal text-slate-500">
              (optional)
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file =
                  event.target
                    .files?.[0] ??
                  null;

                setImageFile(file);

                if (file) {
                  setImageUrl("");
                }
              }}
              className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            />

            <span className="mt-1 block text-xs font-normal text-slate-500">
              JPG, PNG, WebP or AVIF.
              Maximum 5 MB.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              or
            </span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Product image URL

            <span className="ml-1 font-normal text-slate-500">
              (optional)
            </span>

            <input
              type="url"
              value={imageUrl}
              disabled={
                Boolean(imageFile)
              }
              onChange={(event) =>
                setImageUrl(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-black focus:bg-white"
              placeholder="https://..."
            />
          </label>

          {displayPreview ? (
            <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100">
              <img
                src={
                  displayPreview
                }
                alt="Product preview"
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            className="text-sm font-semibold text-red-600"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={publishing}
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {publishing
            ? "Publishing..."
            : "Publish listing"}
        </button>
      </form>
    </PageShell>
  );
}