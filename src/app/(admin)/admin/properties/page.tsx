import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Plus, Home } from "lucide-react";

export default async function PropertiesListPage() {
  const supabase = await createClient();

  const { data: host } = await supabase
    .from("host")
    .select("id")
    .single();

  const { data: properties } = await supabase
    .from("property")
    .select("*")
    .eq("host_id", host?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage your rental properties</p>
        </div>
        <Link href="/admin/properties/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </Link>
      </div>

      {properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/admin/properties/${property.id}`}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group h-full">
                <div className="relative aspect-4/3 bg-muted">
                  {property.cover_image_url ? (
                    <Image
                      src={property.cover_image_url}
                      alt={property.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No properties yet. Add your first property to get started.
            </p>
            <Link href="/admin/properties/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
