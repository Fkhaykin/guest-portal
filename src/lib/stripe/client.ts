import Stripe from "stripe";

// Lazily construct the Stripe client. Importing this module must NOT require
// STRIPE_SECRET_KEY at evaluation time: `next build` collects page data by
// evaluating every route module, and an eager `new Stripe(undefined)` throws
// there ("Neither apiKey nor config.authenticator provided") whenever the
// secret is absent from the build env (e.g. Vercel Preview). Construction is
// deferred to the first property access, which only happens at request time.
let instance: Stripe | null = null;

function getStripe(): Stripe {
  if (!instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    instance = new Stripe(key, {
      apiVersion: "2025-03-31.basil",
      typescript: true,
    });
  }
  return instance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
