import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, createReturn, getCategories, getOrder, getProductById, getProductStock, getProducts, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog and return a short list of matches. Use this for broad lookups: browsing, recommendations, or finding a product's id/slug from its name. Results are summaries only — for questions about one specific item (stock, all images, full details), follow up with getProductDetails. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const order = await getOrder(orderId);
      await notifyReturnInProcess(orderId);
      await preauthorizeRefund(orderId);
      const filed = await createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        reason,
      });
      return { returnId: filed.id, status: filed.status };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});


export const getProductDetails = tool({
  description: `Get the full details for ONE specific product: description, every image, price, tags, live stock level, and a few related products from the same category. Use this whenever the user asks about a particular item (e.g. "Tell me more about the black hoodie", "Is the Vercel mug in stock?"). Requires a product id or slug — if you only have a name, call searchProducts first to find it, then call this. Do not use this for broad browsing; that is what searchProducts is for.`,
  inputSchema: z.object({
    idOrSlug: z
      .string()
      .describe(
        `The product's id or slug, taken from a previous searchProducts result.`,
      ),
  }),
  execute: async ({ idOrSlug }) => {
    try {
      const [product, stock] = await Promise.all([
        getProductById(idOrSlug),
        // Stock is a nice-to-have; don't fail the whole lookup if it errors.
        getProductStock(idOrSlug).catch(() => null),
      ]);
      const related = await getProducts({
        category: product.category,
        limit: 5,
      }).catch(() => []);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: product.category,
        images: product.images,
        tags: product.tags,
        featured: product.featured,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { product: null, error: message };
    }
  },
});
