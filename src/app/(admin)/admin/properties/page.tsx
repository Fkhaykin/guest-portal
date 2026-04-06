import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";

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
        <div className="grid gap-4">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/admin/properties/${property.id}`}
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{property.name}</CardTitle>
                    <Badge variant={property.is_active ? "default" : "secondary"}>
                      {property.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {property.address || `/${property.slug}`}
                  </CardDescription>
                </CardHeader>
                {property.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {property.description}
                    </p>
                  </CardContent>
                )}
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
