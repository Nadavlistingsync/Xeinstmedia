const parsedCap = Number(
  process.env.MAX_CREATOR_ACCOUNTS ??
    process.env.NEXT_PUBLIC_MAX_CREATOR_ACCOUNTS ??
    "3",
);

export const MAX_CREATOR_ACCOUNTS =
  Number.isFinite(parsedCap) && parsedCap > 0 ? Math.floor(parsedCap) : 3;
