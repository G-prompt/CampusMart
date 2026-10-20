
import { Request, Response } from "express";
import { OrderStatus } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { uploadProductImage } from "../lib/cloudinary";
import { getSellerEligibilityMap } from "../services/sellerEligibility.service";

const ALLOWED_SIZES = new Set([
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  ...Array.from({ length: 10 }, (_, index) => `EU ${37 + index}`),
]);

const MAX_IMAGES = 6;
const MAX_COLORS = 18;

type ProductResponseRecord = {
  id: number;
  slug: string;
  title: string;
  category: string;
  price: number;
  rating: number;
  description: string;
  images: string[];
  sizes: string[];
  colors: string[];
  vendorId: string;
  isArchived: boolean;
  archivedAt: Date | null;
  vendor: {
    name: string;
    campus?: string | null;
    universityId?: string | null;
  };
  _count?: {
    orderItems: number;
  };
};

const productResponse = (product: ProductResponseRecord) => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  category: product.category,
  price: product.price,
  rating: product.rating,
  seller: product.vendor.name,
  description: product.description,
  images: product.images,
  sizes: product.sizes,
  colors: product.colors,
  vendorId: product.vendorId,
  sellerCampus: product.vendor.campus ?? null,
  sellerUniversityId: product.vendor.universityId ?? null,
  demandScore: product._count?.orderItems ?? 0,
  isArchived: product.isArchived,
  archivedAt: product.archivedAt,
});

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requestQueryValue(req: Request, key: string): string {
  const query = (
    req as Request & { query?: Record<string, unknown> }
  ).query;

  return cleanText(query?.[key]);
}

function parseStringArrayField(
  value: unknown
): string[] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  let parsed: unknown = value;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  if (parsed.some((item) => typeof item !== "string")) {
    return null;
  }

  return parsed
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function validateSizes(values: string[]): string[] | null {
  const unique = uniqueCaseInsensitive(values);

  if (unique.some((value) => !ALLOWED_SIZES.has(value))) {
    return null;
  }

  return unique;
}

function validateColors(values: string[]): string[] | null {
  const unique = uniqueCaseInsensitive(values);

  if (unique.length > MAX_COLORS) {
    return null;
  }

  if (unique.some((value) => value.length > 30)) {
    return null;
  }

  return unique;
}

const createUniqueSlug = async (title: string) => {
  const baseSlug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listing";

  let slug = baseSlug;
  let counter = 1;

  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

const vendorInclude = {
  vendor: {
    select: {
      name: true,
      campus: true,
      universityId: true,
    },
  },
  _count: {
    select: {
      orderItems: {
        where: {
          status: {
            in: [
              OrderStatus.confirmed,
              OrderStatus.completed,
            ],
          },
        },
      },
    },
  },
};

/*
 * SELLER LISTINGS
 *
 * Seller-only response includes moderationHidden.
 * Public product responses remain unchanged.
 */
export const getVendorProducts = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const products = await prisma.product.findMany({
      where: {
        vendorId: req.user.id,
      },
      include: vendorInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      products: products.map((product) => ({
        ...productResponse(product),

        // Only the owner-facing endpoint receives this flag.
        // Do not expose confidential investigation notes.
        moderationHidden: product.moderationHiddenAt !== null,
      })),
    });
  } catch (error) {
    console.error("Get vendor products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your listings.",
    });
  }
};

/*
 * PUBLIC MARKETPLACE
 */
export const getProducts = async (
  req: Request,
  res: Response
) => {
  try {
    const universityId = requestQueryValue(
      req,
      "universityId"
    );

    const campus = requestQueryValue(req, "campus");

    let demandOrderIds: string[] | null = null;

    if (universityId) {
      const universityOrders = await prisma.order.findMany({
        where: {
          buyer: {
            universityId,
          },
        },
        select: {
          id: true,
        },
      });

      demandOrderIds = universityOrders.map(
        (order) => order.id
      );
    } else if (campus) {
      const campusOrders = await prisma.order.findMany({
        where: {
          buyer: {
            campus,
          },
        },
        select: {
          id: true,
        },
      });

      demandOrderIds = campusOrders.map(
        (order) => order.id
      );
    }

    const products = await prisma.product.findMany({
      where: {
        isArchived: false,
      },
      include: {
        vendor: {
          select: {
            name: true,
            campus: true,
            universityId: true,
          },
        },
        _count: {
          select: {
            orderItems: {
              where: {
                status: {
                  in: [
                    OrderStatus.confirmed,
                    OrderStatus.completed,
                  ],
                },
                ...(demandOrderIds !== null
                  ? {
                      orderId: {
                        in: demandOrderIds,
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const eligibilityMap = await getSellerEligibilityMap(
      products.map((product) => product.vendorId)
    );

    const availableProducts = products.filter(
      (product) =>
        eligibilityMap.get(product.vendorId)?.canSell === true
    );

    return res.status(200).json({
      success: true,
      universityId: universityId || null,
      campus: campus || null,
      products: availableProducts.map(productResponse),
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load products.",
    });
  }
};

/*
 * PUBLIC PRODUCT DETAILS
 */
export const getProductById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        isArchived: false,
      },
      include: vendorInclude,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const eligibilityMap = await getSellerEligibilityMap([
      product.vendorId,
    ]);

    if (!eligibilityMap.get(product.vendorId)?.canSell) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product: productResponse(product),
    });
  } catch (error) {
    console.error("Get product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load product.",
    });
  }
};

/*
 * CREATE PRODUCT
 */
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      title,
      category,
      price,
      description,
      imageUrl,
    } = req.body;

    const numericPrice = Number(price);

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, category, description and a valid price are required.",
      });
    }

    const parsedSizes = parseStringArrayField(
      req.body.sizes
    );

    const parsedColors = parseStringArrayField(
      req.body.colors
    );

    if (parsedSizes === null || parsedColors === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid product size or colour options.",
      });
    }

    const sizes = validateSizes(parsedSizes ?? []);
    const colors = validateColors(parsedColors ?? []);

    if (sizes === null || colors === null) {
      return res.status(400).json({
        success: false,
        message:
          "One or more product size or colour options are invalid.",
      });
    }

    const files = Array.isArray(req.files)
      ? req.files
      : [];

    const cleanImageUrl =
      typeof imageUrl === "string"
        ? imageUrl.trim()
        : "";

    if (files.length === 0 && !cleanImageUrl) {
      return res.status(400).json({
        success: false,
        message: "A main product image is required.",
      });
    }

    const uploadedImages = await Promise.all(
      files.map((file) => uploadProductImage(file.buffer))
    );

    const safeImages = uploadedImages.map(
      (image) => image.url
    );

    if (cleanImageUrl) {
      safeImages.push(cleanImageUrl);
    }

    const slug = await createUniqueSlug(title);

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        slug,
        category: category.trim(),
        price: Math.round(numericPrice),
        description: description.trim(),
        images: safeImages.slice(0, MAX_IMAGES),
        sizes,
        colors,
        vendorId: req.user.id,
        isArchived: false,
        archivedAt: null,
      },
      include: vendorInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Listing published successfully.",
      product: productResponse(product),
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish listing.",
    });
  }
};

/*
 * UPDATE PRODUCT
 */
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        vendorId: true,
        images: true,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (existingProduct.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own listings.",
      });
    }

    const updateData: {
      title?: string;
      category?: string;
      price?: number;
      description?: string;
      images?: string[];
      sizes?: string[];
      colors?: string[];
    } = {};

    const {
      title,
      category,
      price,
      description,
      imageUrl,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty.",
        });
      }

      updateData.title = title.trim();
    }

    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be empty.",
        });
      }

      updateData.category = category.trim();
    }

    if (price !== undefined) {
      const numericPrice = Number(price);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number.",
        });
      }

      updateData.price = Math.round(numericPrice);
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        !description.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Description cannot be empty.",
        });
      }

      updateData.description = description.trim();
    }

    const parsedSizes = parseStringArrayField(
      req.body.sizes
    );

    const parsedColors = parseStringArrayField(
      req.body.colors
    );

    if (parsedSizes === null || parsedColors === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid product size or colour options.",
      });
    }

    if (parsedSizes !== undefined) {
      const sizes = validateSizes(parsedSizes);

      if (sizes === null) {
        return res.status(400).json({
          success: false,
          message: "One or more sizes are invalid.",
        });
      }

      updateData.sizes = sizes;
    }

    if (parsedColors !== undefined) {
      const colors = validateColors(parsedColors);

      if (colors === null) {
        return res.status(400).json({
          success: false,
          message: "One or more colours are invalid.",
        });
      }

      updateData.colors = colors;
    }

    const files = Array.isArray(req.files)
      ? req.files
      : [];

    const uploadedImages = await Promise.all(
      files.map((file) => uploadProductImage(file.buffer))
    );

    const newImages = uploadedImages.map(
      (image) => image.url
    );

    if (
      typeof imageUrl === "string" &&
      imageUrl.trim()
    ) {
      newImages.push(imageUrl.trim());
    }

    if (newImages.length > 0) {
      updateData.images = newImages.slice(
        0,
        MAX_IMAGES
      );
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No listing changes were provided.",
      });
    }

    const updatedProduct = await prisma.product.update({
      where: {
        id,
      },
      data: updateData,
      include: vendorInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Listing updated successfully.",
      product: productResponse(updatedProduct),
    });
  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update listing.",
    });
  }
};

/*
 * SELLER ARCHIVE
 */
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      include: vendorInclude,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only archive your own listings.",
      });
    }

    if (product.isArchived) {
      return res.status(200).json({
        success: true,
        message: "Listing is already archived.",
        product: productResponse(product),
      });
    }

    const archivedProduct = await prisma.product.update({
      where: {
        id,
      },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
      include: vendorInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Listing archived successfully.",
      product: productResponse(archivedProduct),
    });
  } catch (error) {
    console.error("Archive product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to archive listing.",
    });
  }
};

/*
 * SELLER RESTORE
 *
 * An Admin-hidden listing cannot be restored
 * through the seller endpoint.
 */
export const restoreProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      include: vendorInclude,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only restore your own listings.",
      });
    }

    if (product.moderationHiddenAt) {
      return res.status(403).json({
        success: false,
        code: "LISTING_HIDDEN_BY_ADMIN",
        message:
          "This listing was hidden by CampusMart moderation. Contact support to request a review.",
      });
    }

    if (!product.isArchived) {
      return res.status(200).json({
        success: true,
        message: "Listing is already published.",
        product: productResponse(product),
      });
    }

    const restoredProduct = await prisma.product.update({
      where: {
        id,
      },
      data: {
        isArchived: false,
        archivedAt: null,
      },
      include: vendorInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Listing restored successfully.",
      product: productResponse(restoredProduct),
    });
  } catch (error) {
    console.error("Restore product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to restore listing.",
    });
  }
};
