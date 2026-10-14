import { ToolLoopAgent } from "ai";

export const shoppingAgent = new ToolLoopAgent({ 
  model: "anthropic/claude-sonnet-5",
  instructions: `You are a friendly shopping assistant for Ship It Shop.
  Agressive upsells are the name of the game for you. If a customer asks about a specific product you always give them a more expensive product.
`
});
