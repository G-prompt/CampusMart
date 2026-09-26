import { Request, Response } from "express";

import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { uploadProductImage } from "../lib/cloudinary";

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
  vendor: {
    name: string;
  };
}) => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  category: product.category,
  price: product.price,
  rating: product.rating,
  seller: product.vendor.name,
  description: product.description,
  images: product.images,
  vendorId: product.vendorId,
});

const createUniqueSlug = async (title: string) => {
  const baseSlug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listing";

  let slug = baseSlug;
  let counter = 1;

  while (
    await prisma.product.findUnique({
      where: { slug },
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

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
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      products: products.map(productResponse),
    });
  } catch (error) {
    console.error(
      "Get vendor products error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load your listings.",
    });
  }
};

export const getProducts = async (
  _req: Request,
  res: Response
) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      products: products.map(productResponse),
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load products.",
    });
  }
};

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

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!product) {
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

const files = Array.isArray(req.files)
  ? req.files
  : [];

const uploadedImages = await Promise.all(
  files.map((file) =>
    uploadProductImage(file.buffer)
  )
);

const safeImages = uploadedImages.map(
  (image) => image.url
);

if (
  typeof imageUrl === "string" &&
  imageUrl.trim()
) {
  safeImages.push(imageUrl.trim());
}

    const slug = await createUniqueSlug(title);

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        slug,
        category: category.trim(),
        price: Math.round(numericPrice),
        description: description.trim(),
        images: safeImages,
        vendorId: req.user.id,
      },
      include: {
        vendor: {
          select: {
            name: true,
          },
        },
      },
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

    const existingProduct =
      await prisma.product.findUnique({
        where: { id },
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

    if (
      existingProduct.vendorId !==
      req.user.id
    ) {
      return res.status(403).json({
        success: false,
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
    } = req.body;

    const updateData: {
      title?: string;
      category?: string;
      price?: number;
      description?: string;
      images?: string[];
    } = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Title cannot be empty.",
        });
      }

      updateData.title =
        title.trim();
    }

    if (category !== undefined) {
      if (
        typeof category !== "string" ||
        !category.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Category cannot be empty.",
        });
      }

      updateData.category =
        category.trim();
    }

    if (price !== undefined) {
      const numericPrice =
        Number(price);

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Price must be a valid positive number.",
        });
      }

      updateData.price =
        Math.round(numericPrice);
    }

    if (description !== undefined) {
      if (
        typeof description !==
          "string" ||
        !description.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Description cannot be empty.",
        });
      }

      updateData.description =
        description.trim();
    }

    const files =
      Array.isArray(req.files)
        ? req.files
        : [];

    const uploadedImages =
      await Promise.all(
        files.map((file) =>
          uploadProductImage(
            file.buffer
          )
        )
      );

    const newImages =
      uploadedImages.map(
        (image) => image.url
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
     * Only replace the current
     * product images when the
     * vendor actually supplies
     * a new image.
     */
    if (newImages.length > 0) {
      updateData.images =
        newImages.slice(0, 5);
    }

    if (
      Object.keys(updateData)
        .length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No listing changes were provided.",
      });
    }

    const updatedProduct =
      await prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          vendor: {
            select: {
              name: true,
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Listing updated successfully.",
      product:
        productResponse(
          updatedProduct
        ),
    });
  } catch (error) {
    console.error(
      "Update product error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update listing.",
    });
  }
};

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
      where: { id },
      select: {
        id: true,
        vendorId: true,
      },
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
        message: "You can only delete your own listings.",
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Listing deleted successfully.",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete listing.",
    });
  }
};