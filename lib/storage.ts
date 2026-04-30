export function getListingVideoBucket() {
  return process.env.SUPABASE_LISTING_VIDEO_BUCKET || "listing-videos";
}
