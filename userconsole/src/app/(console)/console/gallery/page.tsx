import type { Metadata } from "next";
import { GalleryWorkspace } from "@/components/console/gallery-workspace";

export const metadata: Metadata = {
  title: "企业图库",
};

export default function GalleryPage() {
  return <GalleryWorkspace />;
}
