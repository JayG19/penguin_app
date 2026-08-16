"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui";

export function NewCourseButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "course" } }))}>
      <Plus size={14} /> Add Course
    </Button>
  );
}
