---
name: report:weight-peep-persistence-note
description: "Backlog — persist matrix KPI weight (รวมน้ำหนัก) + peep (รวมปี๊บ) values; currently UI-only transient inputs, not saved"
date: 07-07-26
metadata:
  node_type: memory
  type: report
  feature: pguard-redesign
  phase: backlog
---

# Backlog NOTE — Persist weight (รวมน้ำหนัก) + peep (รวมปี๊บ)

**Registered by:** pguard-redesign Phase 02 PLAN-SUPPLEMENT (07-07-26)

## Context

The pguard daily-order matrix KPI strip has two manual numeric inputs — `รวมน้ำหนัก` (total weight kg) and `รวมปี๊บ` (peep/tin count). In Phase 02 these are **UI-only transient inputs**: NOT persisted and NOT emitted in the `saveOrderSheet` payload (which stays byte-identical: `cell:{shopId}:{variantId}` + `note:{shopId}` only).

## Deferred work

Persist the two values. Options (require design + a schema migration):
- Add `OrderSheet.totalWeightKg` + `OrderSheet.pip` columns and extend the save payload, OR
- Wire `computeTotalWeight(orderLines, factorMap)` once per-product weight/pip factors exist (customer Q22 from the order-system program).

## Why deferred (not in this program)

- pguard-redesign is a **re-skin only** — its charter HARD STOP forbids any change to `schema.prisma` / the `saveOrderSheet` payload / totals result. Persisting these values requires a schema migration + payload change, which is out of scope.
- The per-product weight/pip conversion factors are an open customer question (Q22) carried by the order-system program.

## Resolution when picked up

Route through a fresh RIPER-5 cycle (or a follow-up phase in the order-system program): schema migration → payload extension → matrix wiring → tests. Do NOT fold into pguard-redesign.
