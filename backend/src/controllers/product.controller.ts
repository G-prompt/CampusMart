import {
  Request,
  Response,
} from "express";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  uploadProductImage,
} from "../lib/cloudinary";

import {
  getSellerEligibilityMap,
} from "../services/sellerEligibility.service";

/*
 * =======================================================
 * PRODUCT RESPONSE
 * =======================================================
 */

const productResponse = (product: {
  id: number;
  slug: string;
  title: string;
  category: string;
  price: number;
  rating: number;
  description: string;
  images: string[];
  vendorId: string;

  isArchived: boolean;

  archivedAt:
    | Date
    | null;

  vendor: {
    name: string;
  };
}) => ({
  id:
    product.id,

  slug:
    product.slug,

  title:
    product.title,

  category:
    product.category,

  price:
    product.price,

  rating:
    product.rating,

  seller:
    product.vendor.name,

  description:
    product.description,

  images:
    product.images,

  vendorId:
    product.vendorId,

  isArchived:
    product.isArchived,

  archivedAt:
    product.archivedAt,
});

/*
 * =======================================================
 * PUBLIC PRODUCT AVAILABILITY
 * =======================================================
 *
 * Product publication state and seller eligibility are
 * deliberately separate.
 *
 * A product is publicly available only when:
 *
 * - product is not archived
 * - canonical seller eligibility says canSell === true
 *
 * IMPORTANT:
 *
 * Public marketplace reads do NOT reconcile or mutate a
 * seller account.
 *
 * If a seller temporarily becomes ineligible:
 *
 * isArchived remains false
 *
 * Their product is simply omitted from public marketplace
 * responses until canonical seller eligibility becomes
 * valid again.
 *
 * Seller eligibility itself is evaluated only by
 * sellerEligibility.service.ts.
 */

/*
 * =======================================================
 * UNIQUE SLUG
 * =======================================================
 */

const createUniqueSlug =
  async (
    title: string
  ) => {
    const baseSlug =
      title
        .toLowerCase()
        .trim()
        .replace(
          /[^a-z0-9]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        ) ||
      "listing";

    let slug =
      baseSlug;

    let counter =
      1;

    while (
      await prisma.product.findUnique({
        where: {
          slug,
        },
      })
    ) {
      slug =
        `${baseSlug}-${counter}`;

      counter +=
        1;
    }

    return slug;
  };

/*
 * =======================================================
 * SELLER'S OWN LISTINGS
 * =======================================================
 *
 * Returns BOTH:
 *
 * - published listings
 * - archived listings
 *
 * Seller history remains available even when selling
 * access temporarily changes.
 */

export const getVendorProducts =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const products =
        await prisma.product.findMany({
          where: {
            vendorId:
              req.user.id,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          products:
            products.map(
              productResponse
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Get vendor products error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load your listings.",
        });
    }
  };

/*
 * =======================================================
 * PUBLIC MARKETPLACE
 * =======================================================
 *
 * Public visibility now uses the canonical seller
 * eligibility evaluator instead of maintaining a second
 * copy of the selling requirements here.
 *
 * Flow:
 *
 * 1. load non-archived products
 * 2. batch-load each represented seller once
 * 3. evaluate every seller through the canonical service
 * 4. return only products whose seller canSell
 *
 * This avoids an N+1 seller query pattern.
 */

export const getProducts =
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const products =
        await prisma.product.findMany({
          where: {
            isArchived:
              false,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

      const eligibilityMap =
        await getSellerEligibilityMap(
          products.map(
            (
              product
            ) =>
              product.vendorId
          )
        );

      const availableProducts =
        products.filter(
          (
            product
          ) =>
            eligibilityMap.get(
              product.vendorId
            )
              ?.canSell ===
            true
        );

      return res
        .status(200)
        .json({
          success:
            true,

          products:
            availableProducts.map(
              productResponse
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Get products error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load products.",
        });
    }
  };

/*
 * =======================================================
 * PUBLIC PRODUCT DETAIL
 * =======================================================
 *
 * Product detail follows exactly the same canonical
 * seller-eligibility decision as the marketplace.
 *
 * seller loses eligibility
 * -> direct listing URL becomes unavailable
 *
 * seller becomes eligible again
 * -> same listing becomes available again
 *
 * The product itself is never deleted or archived by
 * public availability checks.
 */

export const getProductById =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          id
        ) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      /*
       * Archive state is a property of the listing itself,
       * so it remains safe to filter at the database level.
       *
       * Seller eligibility is evaluated separately through
       * the canonical seller service.
       */

      const product =
        await prisma.product.findFirst({
          where: {
            id,

            isArchived:
              false,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      const eligibilityMap =
        await getSellerEligibilityMap([
          product.vendorId,
        ]);

      const sellerEligibility =
        eligibilityMap.get(
          product.vendorId
        );

      if (
        !sellerEligibility
          ?.canSell
      ) {
        /*
         * Public callers should not be told whether a
         * hidden listing exists because of seller state,
         * archive state or another availability reason.
         */

        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          product:
            productResponse(
              product
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Get product error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load product.",
        });
    }
  };

/*
 * =======================================================
 * CREATE PRODUCT
 * =======================================================
 *
 * Full seller eligibility is enforced by route middleware.
 *
 * requireSellerEligibility uses the same canonical seller
 * eligibility service as public marketplace visibility.
 */

export const createProduct =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const {
        title,
        category,
        price,
        description,
        imageUrl,
      } =
        req.body;

      const numericPrice =
        Number(
          price
        );

      if (
        typeof title !==
          "string" ||
        !title.trim() ||
        typeof category !==
          "string" ||
        !category.trim() ||
        typeof description !==
          "string" ||
        !description.trim() ||
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Title, category, description and a valid price are required.",
          });
      }

      const files =
        Array.isArray(
          req.files
        )
          ? req.files
          : [];

      const uploadedImages =
        await Promise.all(
          files.map(
            (
              file
            ) =>
              uploadProductImage(
                file.buffer
              )
          )
        );

      const safeImages =
        uploadedImages.map(
          (
            image
          ) =>
            image.url
        );

      if (
        typeof imageUrl ===
          "string" &&
        imageUrl.trim()
      ) {
        safeImages.push(
          imageUrl.trim()
        );
      }

      const slug =
        await createUniqueSlug(
          title
        );

      const product =
        await prisma.product.create({
          data: {
            title:
              title.trim(),

            slug,

            category:
              category.trim(),

            price:
              Math.round(
                numericPrice
              ),

            description:
              description.trim(),

            images:
              safeImages.slice(
                0,
                5
              ),

            vendorId:
              req.user.id,

            isArchived:
              false,

            archivedAt:
              null,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Listing published successfully.",

          product:
            productResponse(
              product
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Create product error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to publish listing.",
        });
    }
  };

/*
 * =======================================================
 * UPDATE PRODUCT
 * =======================================================
 *
 * Seller eligibility is enforced by route middleware.
 *
 * Updating an archived listing does NOT automatically
 * republish it.
 */

export const updateProduct =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          id
        ) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const existingProduct =
        await prisma.product.findUnique({
          where: {
            id,
          },

          select: {
            id:
              true,

            vendorId:
              true,

            images:
              true,

            isArchived:
              true,
          },
        });

      if (
        !existingProduct
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      if (
        existingProduct.vendorId !==
        req.user.id
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You can only edit your own listings.",
          });
      }

      const {
        title,
        category,
        price,
        description,
        imageUrl,
      } =
        req.body;

      const updateData: {
        title?: string;
        category?: string;
        price?: number;
        description?: string;
        images?: string[];
      } = {};

      if (
        title !==
        undefined
      ) {
        if (
          typeof title !==
            "string" ||
          !title.trim()
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Title cannot be empty.",
            });
        }

        updateData.title =
          title.trim();
      }

      if (
        category !==
        undefined
      ) {
        if (
          typeof category !==
            "string" ||
          !category.trim()
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Category cannot be empty.",
            });
        }

        updateData.category =
          category.trim();
      }

      if (
        price !==
        undefined
      ) {
        const numericPrice =
          Number(
            price
          );

        if (
          !Number.isFinite(
            numericPrice
          ) ||
          numericPrice <= 0
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Price must be a valid positive number.",
            });
        }

        updateData.price =
          Math.round(
            numericPrice
          );
      }

      if (
        description !==
        undefined
      ) {
        if (
          typeof description !==
            "string" ||
          !description.trim()
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              message:
                "Description cannot be empty.",
            });
        }

        updateData.description =
          description.trim();
      }

      const files =
        Array.isArray(
          req.files
        )
          ? req.files
          : [];

      const uploadedImages =
        await Promise.all(
          files.map(
            (
              file
            ) =>
              uploadProductImage(
                file.buffer
              )
          )
        );

      const newImages =
        uploadedImages.map(
          (
            image
          ) =>
            image.url
        );

      if (
        typeof imageUrl ===
          "string" &&
        imageUrl.trim()
      ) {
        newImages.push(
          imageUrl.trim()
        );
      }

      /*
       * Only replace the current gallery when the seller
       * supplies at least one new image.
       */

      if (
        newImages.length >
        0
      ) {
        updateData.images =
          newImages.slice(
            0,
            5
          );
      }

      if (
        Object.keys(
          updateData
        ).length ===
        0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "No listing changes were provided.",
          });
      }

      const updatedProduct =
        await prisma.product.update({
          where: {
            id,
          },

          data:
            updateData,

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Listing updated successfully.",

          product:
            productResponse(
              updatedProduct
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Update product error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to update listing.",
        });
    }
  };

/*
 * =======================================================
 * ARCHIVE PRODUCT
 * =======================================================
 *
 * This intentionally keeps the old export name
 * `deleteProduct` for route compatibility.
 *
 * IMPORTANT:
 *
 * This is NOT a database delete.
 *
 * Archiving remains available even when seller
 * eligibility later lapses because removing an item from
 * sale is a risk-reducing action.
 */

export const deleteProduct =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          id
        ) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      if (
        product.vendorId !==
        req.user.id
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You can only archive your own listings.",
          });
      }

      /*
       * Repeating the archive request is harmless.
       */

      if (
        product.isArchived
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "Listing is already archived.",

            product:
              productResponse(
                product
              ),
          });
      }

      const archivedProduct =
        await prisma.product.update({
          where: {
            id,
          },

          data: {
            isArchived:
              true,

            archivedAt:
              new Date(),
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Listing archived successfully.",

          product:
            productResponse(
              archivedProduct
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Archive product error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to archive listing.",
        });
    }
  };

/*
 * =======================================================
 * RESTORE PRODUCT
 * =======================================================
 *
 * Full seller eligibility is enforced by route middleware.
 *
 * Restoring a listing counts as new selling activity.
 */

export const restoreProduct =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          id
        ) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      if (
        product.vendorId !==
        req.user.id
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You can only restore your own listings.",
          });
      }

      /*
       * Repeating restore on an already-published listing
       * is also harmless.
       */

      if (
        !product.isArchived
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "Listing is already published.",

            product:
              productResponse(
                product
              ),
          });
      }

      const restoredProduct =
        await prisma.product.update({
          where: {
            id,
          },

          data: {
            isArchived:
              false,

            archivedAt:
              null,
          },

          include: {
            vendor: {
              select: {
                name:
                  true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Listing restored successfully.",

          product:
            productResponse(
              restoredProduct
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "Restore product error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to restore listing.",
        });
    }
  };