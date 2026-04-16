"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Home, GripVertical } from "lucide-react";

interface Property {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function SortablePropertyCard({ property }: { property: Property }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group h-full relative">
        <button
          {...attributes}
          {...listeners}
          className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Link href={`/admin/properties/${property.id}`}>
          <div className="relative aspect-4/3 bg-muted">
            {property.cover_image_url ? (
              <Image
                src={property.cover_image_url}
                alt={property.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Home className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
            <Badge
              variant={property.is_active ? "default" : "secondary"}
              className="absolute top-3 right-3"
            >
              {property.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold line-clamp-1">{property.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
              {property.address || `/${property.slug}`}
            </p>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}

export function SortablePropertiesGrid({
  properties: initialProperties,
}: {
  properties: Property[];
}) {
  const [properties, setProperties] = useState(initialProperties);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = properties.findIndex((p) => p.id === active.id);
    const newIndex = properties.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(properties, oldIndex, newIndex);
    setProperties(reordered);

    setSaving(true);
    try {
      await fetch("/api/admin/reorder-properties", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: reordered.map((p, i) => ({ id: p.id, sort_order: i })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      {saving && (
        <div className="absolute -top-8 right-0 text-sm text-muted-foreground animate-pulse">
          Saving order...
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={properties.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {properties.map((property) => (
              <SortablePropertyCard key={property.id} property={property} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
