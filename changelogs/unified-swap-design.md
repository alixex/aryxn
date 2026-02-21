# Unified Swap UI/UX Design & Implementation Plan

## Background
Currently, the Aryxn platform separates "Swap" (same-chain) and "Bridge" (cross-chain) into two distinct tabs. From an "Intent-centric" perspective, users only care about exchanging Token A for Token B. This document outlines the design and plan for a unified exchange interface.

## UI/UX Design Specifications

### General Aesthetic
We will adopt a modern, cohesive Web3 aesthetic. Using the existing `glass-premium` and `glass-strong` themes, we'll design a card with high visual clarity.

### Interaction Flow
1.  **Unified Form (You Pay & You Receive Blocks):**
    -   **"You Pay" Block:** A cohesive, slightly tinted box containing the label "You Pay", a large invisible-bordered input for the amount, and a combined Network/Token selector pill.
    -   **Swap Divider:** An overlapping circular `ArrowDownUp` button to flip origin and destination seamlessly.
    -   **"You Receive" Block:** Functionally identical, but the amount is a read-only estimate.
2.  **Smart Configuration (Settings & Addressee):**
    -   **Settings:** A top-right gear icon to set "Slippage Tolerance" and "Bridge Priority".
    -   **Recipient Address:** Hidden by default (assumes the user's own address). Can be expanded to send to a custom address.
3.  **Intelligent Quote Display:**
    -   Automatically routes to `useExchange` (same-chain) or `useBridge` (cross-chain).
    -   **Same Chain:** Displays "Provider", "Price Impact", "Network Fee", "Est. Time (< 1 min)".
    -   **Cross Chain:** Displays "Provider", "Bridge Fee", "Gas Fee", "Est. Time (~ X mins)".
4.  **Action Button:**
    -   A prominent, full-width button. Changes state intelligently: "Enter an amount", "Select Destination Network", "Swap", etc.

## Technical Implementation Steps

1.  **Create `UniversalSwapCard.tsx`:**
    -   Design the unified UI blocks.
    -   Manage unified state: `sourceChain`, `sourceToken`, `destChain`, `destToken`, `amount`.
    -   Implement the routing logic: `const isCrossChain = sourceChain !== destChain`.
2.  **Update `Swap.tsx` Page:**
    -   Remove the "Bridge" tab.
    -   Render `<UniversalSwapCard />` instead of `<SwapCard>` and `<BridgeCard>`.
3.  **Cleanup:**
    -   Delete the old `SwapCard.tsx` and `BridgeCard.tsx` components.
