import { Router, type IRouter } from "express";

const products = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Produto ${i + 1}`,
  price: Math.round((9.99 + i * 1.5) * 100) / 100,
  sku: `SKU-${String(i + 1).padStart(4, "0")}`,
}));

export const routes: IRouter = Router();

routes.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "demo-api" });
});

routes.get("/api/products/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = products.find((p) => p.id === id);
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }
  res.json(product);
});

routes.get("/api/products", (_req, res) => {
  res.json({ count: products.length, products: products.slice(0, 10) });
});
